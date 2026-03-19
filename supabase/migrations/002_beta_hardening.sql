-- Sprint Beta Hardening
-- Canonical persistence + problem provenance + bulk manual import

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'local-user',
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS license_note TEXT,
  ADD COLUMN IF NOT EXISTS parser_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS curation_status TEXT,
  ADD COLUMN IF NOT EXISTS corpus_tier TEXT,
  ADD COLUMN IF NOT EXISTS canonical_hash TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_estimate TEXT,
  ADD COLUMN IF NOT EXISTS explanation_quality DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS last_curated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS curated_by TEXT;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'local-user';

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'local-user';

ALTER TABLE error_reports
  ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'local-user',
  ADD COLUMN IF NOT EXISTS review_queue_id UUID REFERENCES review_queue(id);

ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'local-user';

ALTER TABLE review_queue
  ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'local-user';

CREATE TABLE IF NOT EXISTS problem_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL DEFAULT 'local-user',
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'csv')),
  source_name TEXT,
  source_url TEXT,
  license_note TEXT,
  notes TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  created_rows INTEGER NOT NULL DEFAULT 0 CHECK (created_rows >= 0),
  invalid_rows INTEGER NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  duplicate_rows INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_rows >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_problems (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  owner_id TEXT NOT NULL DEFAULT 'local-user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, position),
  UNIQUE (session_id, problem_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'problems_source_type_check'
  ) THEN
    ALTER TABLE problems
      ADD CONSTRAINT problems_source_type_check
      CHECK (source_type IS NULL OR source_type IN ('manual', 'external', 'generated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'problems_curation_status_check'
  ) THEN
    ALTER TABLE problems
      ADD CONSTRAINT problems_curation_status_check
      CHECK (curation_status IS NULL OR curation_status IN ('draft', 'needs_review', 'accepted', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'problems_corpus_tier_check'
  ) THEN
    ALTER TABLE problems
      ADD CONSTRAINT problems_corpus_tier_check
      CHECK (corpus_tier IS NULL OR corpus_tier IN ('gold', 'scale', 'filler'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'problems_difficulty_estimate_check'
  ) THEN
    ALTER TABLE problems
      ADD CONSTRAINT problems_difficulty_estimate_check
      CHECK (difficulty_estimate IS NULL OR difficulty_estimate IN ('easy', 'medium', 'hard'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'problems_import_batch_fk'
  ) THEN
    ALTER TABLE problems
      ADD CONSTRAINT problems_import_batch_fk
      FOREIGN KEY (import_batch_id) REFERENCES problem_import_batches(id);
  END IF;
END $$;

UPDATE problems
SET
  source_type = COALESCE(
    source_type,
    CASE
      WHEN source = 'ai_generated' THEN 'generated'
      WHEN source = 'external_import' THEN 'external'
      ELSE 'manual'
    END
  ),
  parser_confidence = COALESCE(
    parser_confidence,
    NULLIF(content #>> '{generation_meta,parser,confidence}', '')::DOUBLE PRECISION,
    NULLIF(content #>> '{import_meta,parser,confidence}', '')::DOUBLE PRECISION
  ),
  curation_status = COALESCE(
    curation_status,
    CASE
      WHEN tags @> ARRAY['rejected']::TEXT[] THEN 'rejected'
      WHEN tags && ARRAY['needs_review', 'on_hold', 'duplicate_candidate']::TEXT[] THEN 'needs_review'
      ELSE 'accepted'
    END
  ),
  corpus_tier = COALESCE(
    corpus_tier,
    CASE
      WHEN source = 'ai_generated' THEN 'filler'
      ELSE 'gold'
    END
  ),
  difficulty_estimate = COALESCE(difficulty_estimate, difficulty),
  canonical_hash = COALESCE(
    canonical_hash,
    NULLIF(
      lower(regexp_replace(COALESCE(content->>'stem', ''), '\s+', ' ', 'g')) ||
      '::' ||
      lower(
        regexp_replace(
          COALESCE(
            (
              SELECT string_agg(trim(choice_text), '||' ORDER BY ordinality)
              FROM jsonb_array_elements_text(COALESCE(content->'choices', '[]'::jsonb)) WITH ORDINALITY AS choice(choice_text, ordinality)
            ),
            ''
          ),
          '\s+',
          ' ',
          'g'
        )
      ),
      '::'
    )
  ),
  last_curated_at = COALESCE(
    last_curated_at,
    CASE WHEN COALESCE(curation_status, 'accepted') = 'accepted' THEN created_at ELSE NULL END
  );

INSERT INTO session_problems (session_id, problem_id, position)
SELECT
  sessions.id,
  ordered.problem_id::UUID,
  ordered.ordinality - 1
FROM sessions
CROSS JOIN LATERAL jsonb_array_elements_text(
  COALESCE(sessions.meta->'ordered_problem_ids', '[]'::jsonb)
) WITH ORDINALITY AS ordered(problem_id, ordinality)
ON CONFLICT (session_id, position) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_problems_curation ON problems(curation_status, corpus_tier, section);
CREATE INDEX IF NOT EXISTS idx_problems_import_batch ON problems(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_problems_canonical_hash ON problems(canonical_hash);
CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON problem_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_problems_session_position ON session_problems(session_id, position);
