CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══ 문제 은행 ═══
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('verbal', 'quant', 'di')),
  sub_type TEXT NOT NULL,
    -- verbal: cr_strengthen, cr_weaken, cr_assumption, cr_evaluate, cr_inference,
    --         rc_main_idea, rc_detail, rc_inference, rc_structure
    -- quant: algebra, arithmetic, ratio_percent, inequality, number_theory,
    --        geometry, word_problem, combinatorics, statistics
    -- di: two_part, table_analysis, graphics_interpretation,
    --     multi_source, data_sufficiency
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  content JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 세션 ═══
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN (
    'sprint_verbal', 'sprint_quant', 'sprint_di',
    'mock_full', 'mock_section', 'review', 'drill'
  )),
  recipe TEXT,
  duration_planned_min INTEGER NOT NULL,
  duration_actual_min INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'
);

-- ═══ 풀이 기록 ═══
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES problems(id),
  session_id UUID REFERENCES sessions(id),
  user_answer INTEGER,
  is_correct BOOLEAN NOT NULL,
  time_spent_sec INTEGER NOT NULL,
  exceeded_cutoff BOOLEAN DEFAULT FALSE,
  confidence TEXT CHECK (confidence IN ('sure', 'unsure', 'guessed')),
  pre_think JSONB,
    -- CR: { conclusion, premise, assumption, gap }
    -- RC: { paragraph_tags: string[] }
    -- QR: { constraints, approach }
    -- DI: { question_label, unit, axis, legend }
    -- DS: { question_reframed, stmt1_alone, stmt2_alone }
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- 오답 리포트 v3.0 — Quick/Deep 하이브리드
-- ═══════════════════════════════════════════════════════════
CREATE TABLE error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES attempts(id),
  report_mode TEXT NOT NULL DEFAULT 'quick' CHECK (report_mode IN ('quick', 'deep')),
  
  -- ═══ QUICK MODE (세션 중 — 3문장, 1분 이내) ═══
  -- 항상 작성. 세션 흐름 안 끊김.
  
  my_frame TEXT NOT NULL,
    -- "나는 ~라고 보고, ~를 중요하다고 착각해서 이 선택지를 유지했다"
  
  correct_mechanism TEXT NOT NULL,
    -- "이 문제는 사실 ~가 결론이고, ~라는 전제 + ~라는 숨은 가정 때문에
    --  정답은 ~가 될 수밖에 없다"
    -- 근거가 되는 문장을 가져온다.
  
  next_tool TEXT NOT NULL,
    -- Key Question 1개 + Key Factor 1문장
    -- "Q: 이 논증에서 빠진 전제는? → F: 'than 뒤 = Old = 분모'로 먼저 적는다"

  -- ═══ DEEP MODE (복기/Consolidation 시 — Quick 확장) ═══
  -- 복기 45분 또는 Consolidation 30분에서 Quick을 확장.
  -- nullable — Quick만 쓰고 나중에 채울 수 있음.
  
  mechanism_english TEXT,
    -- 핵심 메커니즘을 영어로
    -- "The correct answer strengthens the causal link by eliminating..."
  
  logic_comparison TEXT,
    -- 정답 논리 vs 내 인출 논리 → 탑재사고
    -- "내 인출: ~ → 정답 논리: ~ → 탑재사고: ~"
  
  -- 유형별 서브 리포트 (JSONB, nullable)
  sub_report JSONB,
    -- CR: { conclusion_restated, gap_identified, which_choice_attacked_c }
    -- RC: { paragraph_function_error, index_paraphrase_check }
    -- DS: { question_reframed_as, sufficiency_pivot }
    -- QR%: { base_value_identified, relationship_type }

  -- ═══ 에러 분류 (Quick에서도 작성) ═══
  failure_stage TEXT CHECK (failure_stage IN (
    'reading', 'strategy', 'calculation', 'verification', 'time_pressure'
  )),
  error_type TEXT,

  -- ═══ AI 자동 생성 (Deep 전환 시 생성) ═══
  ai_wrong_choices TEXT,
  ai_core_principle TEXT,
  ai_emotional_diary TEXT,
  ai_visual_concept TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deepened_at TIMESTAMPTZ
);

-- ═══ Rule 카드 ═══
CREATE TABLE rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  section TEXT,
  source_report_id UUID REFERENCES error_reports(id),
  is_top20 BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Spaced Repetition 큐 ═══
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES problems(id),
  next_review_at TIMESTAMPTZ NOT NULL,
  interval_days INTEGER DEFAULT 1,
  ease_factor REAL DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  priority_score REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 일일 기록 ═══
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL UNIQUE,
  verbal_sprint_done BOOLEAN DEFAULT FALSE,
  quant_di_sprint_done BOOLEAN DEFAULT FALSE,
  error_reports_count INTEGER DEFAULT 0,
  deep_reports_count INTEGER DEFAULT 0,
  rule_of_day TEXT,
  top_error_cause TEXT,
  tomorrow_problems UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 3주 캘린더 ═══
CREATE TABLE calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_date DATE NOT NULL UNIQUE,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 0 AND 4),
  intensity_level INTEGER CHECK (intensity_level BETWEEN 1 AND 3),
  planned_verbal TEXT,
  planned_main TEXT,
  is_mock_day BOOLEAN DEFAULT FALSE,
  is_rest_day BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  actual_notes TEXT
);

-- ═══ Views ═══
CREATE VIEW section_stats AS
SELECT p.section, p.sub_type,
  COUNT(*) AS total_attempts,
  AVG(CASE WHEN a.is_correct THEN 1 ELSE 0 END)::REAL AS accuracy,
  AVG(a.time_spent_sec)::REAL AS avg_time_sec,
  COUNT(*) FILTER (WHERE a.exceeded_cutoff) AS cutoff_exceeded_count
FROM attempts a JOIN problems p ON a.problem_id = p.id
GROUP BY p.section, p.sub_type;

CREATE VIEW tag_weakness AS
SELECT unnest(p.tags) AS tag, p.section,
  COUNT(*) AS total,
  AVG(CASE WHEN a.is_correct THEN 1 ELSE 0 END)::REAL AS accuracy,
  COUNT(*) FILTER (WHERE NOT a.is_correct) AS error_count
FROM attempts a JOIN problems p ON a.problem_id = p.id
GROUP BY unnest(p.tags), p.section
HAVING COUNT(*) >= 3 ORDER BY accuracy ASC;

CREATE VIEW error_distribution AS
SELECT er.failure_stage, er.error_type, p.section,
  COUNT(*) AS count,
  COUNT(*)::REAL / SUM(COUNT(*)) OVER (PARTITION BY p.section) AS ratio
FROM error_reports er
JOIN attempts a ON er.attempt_id = a.id
JOIN problems p ON a.problem_id = p.id
GROUP BY er.failure_stage, er.error_type, p.section
ORDER BY count DESC;

-- 인덱스
CREATE INDEX idx_attempts_problem ON attempts(problem_id);
CREATE INDEX idx_attempts_session ON attempts(session_id);
CREATE INDEX idx_attempts_time ON attempts(attempted_at DESC);
CREATE INDEX idx_reports_attempt ON error_reports(attempt_id);
CREATE INDEX idx_reports_time ON error_reports(created_at DESC);
CREATE INDEX idx_reports_mode ON error_reports(report_mode);
CREATE INDEX idx_review_next ON review_queue(next_review_at);
CREATE INDEX idx_review_priority ON review_queue(priority_score DESC);
