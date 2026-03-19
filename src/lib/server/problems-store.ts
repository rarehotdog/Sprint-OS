import {
  parsedSectionResultSchema,
} from "@/lib/contracts/problem-contracts";
import type {
  CreateProblemInput,
  ParsedSectionResult,
  ProblemImportBatch,
  UpdateProblemReviewStatusInput,
} from "@/lib/contracts/problem-contracts";
import type {
  Problem,
  ProblemCorpusTier,
  ProblemCurationStatus,
  ReviewStatus,
} from "@/lib/types";

interface ProblemsDb {
  problems: Map<string, Problem>;
  importBatches: Map<string, ProblemImportBatch>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatProblemsDb__: ProblemsDb | undefined;
}

function getDb(): ProblemsDb {
  if (!global.__gmatProblemsDb__) {
    global.__gmatProblemsDb__ = {
      problems: new Map<string, Problem>(),
      importBatches: new Map<string, ProblemImportBatch>(),
    };
  }
  return global.__gmatProblemsDb__;
}

function now(): string {
  return new Date().toISOString();
}

function dedupeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function deriveLegacySource(input: CreateProblemInput): string {
  if (input.source && input.source.trim().length > 0) {
    return input.source.trim();
  }

  if (input.source_type === "generated") {
    return "ai_generated";
  }

  if (input.source_type === "external") {
    return "external_import";
  }

  return "manual_capture";
}

function normalizeStem(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function normalizeChoices(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean);
}

export function computeProblemCanonicalHash(input: {
  stem: unknown;
  choices: unknown;
}): string | null {
  const stem = normalizeStem(input.stem);
  const choices = normalizeChoices(input.choices);

  if (!stem || choices.length === 0) {
    return null;
  }

  return `${stem}::${choices.join("||")}`;
}

function getProblemParser(problem: Problem): ParsedSectionResult | null {
  const content = problem.content as {
    generation_meta?: { parser?: unknown };
    import_meta?: { parser?: unknown };
  };
  const candidate = content.generation_meta?.parser ?? content.import_meta?.parser;
  const parsed = parsedSectionResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function normalizeProblem(input: CreateProblemInput, problemId?: string, createdAt?: string): Problem {
  const parser = parsedSectionResultSchema.safeParse(
    (input.content as { generation_meta?: { parser?: unknown }; import_meta?: { parser?: unknown } })
      .generation_meta?.parser ??
      (input.content as { import_meta?: { parser?: unknown } }).import_meta?.parser,
  );
  const parserConfidence = input.parser_confidence ?? (parser.success ? parser.data.confidence : null);
  const canonicalHash =
    input.canonical_hash ??
    computeProblemCanonicalHash({
      stem: input.content.stem,
      choices: input.content.choices,
    });

  return {
    id: problemId ?? crypto.randomUUID(),
    section: input.section,
    sub_type: input.sub_type,
    difficulty: input.difficulty ?? null,
    content: input.content,
    tags: dedupeTags(input.tags ?? []),
    source: deriveLegacySource(input),
    source_type: input.source_type ?? "manual",
    source_name: input.source_name ?? null,
    source_url: input.source_url ?? null,
    external_id: input.external_id ?? null,
    license_note: input.license_note ?? null,
    parser_confidence: parserConfidence,
    curation_status: input.curation_status ?? "accepted",
    corpus_tier: input.corpus_tier ?? "gold",
    canonical_hash: canonicalHash,
    difficulty_estimate: input.difficulty_estimate ?? input.difficulty ?? null,
    explanation_quality: input.explanation_quality ?? null,
    import_batch_id: input.import_batch_id ?? null,
    last_curated_at: input.last_curated_at ?? null,
    curated_by: input.curated_by ?? null,
    created_at: createdAt ?? now(),
  };
}

export function listProblems(section?: Problem["section"]): Problem[] {
  const all = Array.from(getDb().problems.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  if (!section) return all;
  return all.filter((item) => item.section === section);
}

export function listSolveReadyProblems(section?: Problem["section"]): Problem[] {
  return listProblems(section).filter(
    (problem) =>
      problem.curation_status === "accepted" &&
      (problem.corpus_tier === "gold" || problem.corpus_tier === "scale"),
  );
}

export function listProblemsByIds(problemIds: string[]): Problem[] {
  const uniqueIds = Array.from(new Set(problemIds));
  return uniqueIds
    .map((problemId) => getProblemById(problemId))
    .filter((problem): problem is Problem => problem !== null);
}

export function createProblem(input: CreateProblemInput): Problem {
  const created = normalizeProblem(input);
  getDb().problems.set(created.id, created);
  return created;
}

export function getProblemById(problemId: string): Problem | null {
  return getDb().problems.get(problemId) ?? null;
}

export function getProblemReviewStatus(problem: Problem): ReviewStatus {
  if (problem.curation_status) {
    return problem.curation_status === "accepted" ? "accepted" : "needs_review";
  }

  const tagSet = new Set(problem.tags);
  if (tagSet.has("needs_review") || tagSet.has("on_hold")) {
    return "needs_review";
  }

  return "accepted";
}

export function createProblemImportBatch(input: {
  input_type: ProblemImportBatch["input_type"];
  source_name?: string | null;
  source_url?: string | null;
  license_note?: string | null;
  notes?: string | null;
  total_rows: number;
  created_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
}): ProblemImportBatch {
  const batch: ProblemImportBatch = {
    id: crypto.randomUUID(),
    input_type: input.input_type,
    source_name: input.source_name ?? null,
    source_url: input.source_url ?? null,
    license_note: input.license_note ?? null,
    notes: input.notes ?? null,
    total_rows: input.total_rows,
    created_rows: input.created_rows,
    invalid_rows: input.invalid_rows,
    duplicate_rows: input.duplicate_rows,
    created_at: now(),
  };

  getDb().importBatches.set(batch.id, batch);
  return batch;
}

export function listProblemImportBatches(): ProblemImportBatch[] {
  return Array.from(getDb().importBatches.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export function getProblemImportBatchById(batchId: string): ProblemImportBatch | null {
  return getDb().importBatches.get(batchId) ?? null;
}

export function countProblemsByCanonicalHash(canonicalHash: string | null): number {
  if (!canonicalHash) {
    return 0;
  }

  return listProblems().filter((problem) => problem.canonical_hash === canonicalHash).length;
}

export interface ProblemReviewItem {
  problem: Problem;
  parser: ParsedSectionResult | null;
  review_status: ReviewStatus;
  duplicate_count: number;
}

export interface ListProblemReviewFilters {
  review_status?: ReviewStatus;
  curation_status?: ProblemCurationStatus;
  corpus_tier?: ProblemCorpusTier;
  import_batch_id?: string;
  section?: Problem["section"];
  source?: string;
  tag?: string;
  limit: number;
}

function toProblemReviewItem(problem: Problem): ProblemReviewItem {
  return {
    problem,
    parser: getProblemParser(problem),
    review_status: getProblemReviewStatus(problem),
    duplicate_count: countProblemsByCanonicalHash(problem.canonical_hash ?? null),
  };
}

export function getProblemReviewItem(problemId: string): ProblemReviewItem | null {
  const problem = getProblemById(problemId);
  if (!problem) {
    return null;
  }

  return toProblemReviewItem(problem);
}

export function listProblemReviewItems(filters: ListProblemReviewFilters): {
  items: ProblemReviewItem[];
  total: number;
} {
  const sourceFiltered = listProblems().filter((problem) => {
    if (filters.section && problem.section !== filters.section) {
      return false;
    }

    if (filters.source && problem.source !== filters.source) {
      return false;
    }

    if (filters.tag && !problem.tags.includes(filters.tag)) {
      return false;
    }

    if (filters.import_batch_id && problem.import_batch_id !== filters.import_batch_id) {
      return false;
    }

    if (filters.curation_status && problem.curation_status !== filters.curation_status) {
      return false;
    }

    if (filters.corpus_tier && problem.corpus_tier !== filters.corpus_tier) {
      return false;
    }

    return true;
  });

  const mapped = sourceFiltered.map((problem) => toProblemReviewItem(problem));

  const statusFiltered = mapped.filter((item) => {
    if (!filters.review_status) {
      return true;
    }

    return item.review_status === filters.review_status;
  });

  return {
    total: statusFiltered.length,
    items: statusFiltered.slice(0, filters.limit),
  };
}

function nextCurationStatusForAction(
  current: Problem,
  action: UpdateProblemReviewStatusInput["action"],
): ProblemCurationStatus {
  if (action === "accept") {
    return "accepted";
  }

  if (action === "reject") {
    return "rejected";
  }

  if (action === "hold") {
    return "needs_review";
  }

  return current.curation_status ?? "needs_review";
}

export function updateProblemReviewStatus(input: UpdateProblemReviewStatusInput): ProblemReviewItem {
  const found = getProblemById(input.problem_id);
  if (!found) {
    throw new Error("Problem not found");
  }

  const tagSet = new Set(found.tags);
  if (input.sub_type) {
    tagSet.add(input.sub_type);
  }
  if (input.tags) {
    for (const tag of input.tags) {
      tagSet.add(tag);
    }
  }
  if (input.action === "hold") {
    tagSet.add("on_hold");
  } else {
    tagSet.delete("on_hold");
  }

  const nextContent: Record<string, unknown> = { ...found.content };
  if (input.note && input.note.trim().length > 0) {
    nextContent.review_note = input.note.trim();
  }

  const updated: Problem = {
    ...found,
    section: input.section ?? found.section,
    sub_type: input.sub_type ?? found.sub_type,
    content: nextContent,
    tags: Array.from(tagSet),
    source_name: input.source_name ?? found.source_name ?? null,
    source_url: input.source_url ?? found.source_url ?? null,
    license_note: input.license_note ?? found.license_note ?? null,
    difficulty_estimate: input.difficulty_estimate ?? found.difficulty_estimate ?? null,
    corpus_tier: input.corpus_tier ?? found.corpus_tier ?? null,
    curation_status: nextCurationStatusForAction(found, input.action),
    last_curated_at: now(),
    curated_by: input.curated_by ?? found.curated_by ?? null,
  };

  getDb().problems.set(updated.id, updated);
  return toProblemReviewItem(updated);
}

export function seedProblemsStore(input: {
  problems: Problem[];
  import_batches?: ProblemImportBatch[];
}): void {
  global.__gmatProblemsDb__ = {
    problems: new Map(input.problems.map((problem) => [problem.id, problem])),
    importBatches: new Map((input.import_batches ?? []).map((batch) => [batch.id, batch])),
  };
}

export function resetProblemsStoreForTests(): void {
  global.__gmatProblemsDb__ = {
    problems: new Map<string, Problem>(),
    importBatches: new Map<string, ProblemImportBatch>(),
  };
}
