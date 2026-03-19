import type {
  CalendarDay,
  DailyCheckin,
  DailyLog,
  DailyPlan,
  ErrorReport,
  Problem,
  ProblemCorpusTier,
  ProblemImportBatch,
  ReviewInboxSnapshot,
  ReviewQueueItem,
  ReviewReportsSnapshot,
  Rule,
  Session,
  Attempt,
  TodayNextAction,
  TodaySnapshot,
} from "@/lib/types";

import { ensureUpcomingCalendar } from "@/lib/server/calendar-store";
import { getTodayLog } from "@/lib/server/daily-log-store";
import {
  createProblem,
  createProblemImportBatch,
  getProblemById,
  getProblemImportBatchById,
  getProblemReviewItem,
  getProblemReviewStatus,
  listProblemImportBatches,
  listProblemReviewItems,
  listProblems,
  listProblemsByIds,
  listSolveReadyProblems,
  seedProblemsStore,
  updateProblemReviewStatus,
} from "@/lib/server/problems-store";
import {
  attachAiAnalysis,
  createQuickReport,
  deepenReport,
  getReportById,
  listPendingDeepReports,
  listReports,
  listRules,
  seedReportStore,
} from "@/lib/server/report-store";
import { getReviewInbox, getReviewReportsView } from "@/lib/server/review-inbox-store";
import { getQueueItem, listQueueItems, seedQueueItems, upsertQueueItem } from "@/lib/server/review-queue-store";
import {
  completeSession,
  createAttempt,
  createSession,
  getAttemptById,
  getSessionById,
  getSessionRunState,
  getSessionSolveContext,
  listAttempts,
  listSessions,
  seedSolveStore,
} from "@/lib/server/solve-store";
import {
  attachSessionToPlanBlock,
  generateDailyPlan,
  getTodaySnapshot,
  replanDaily,
  startTodayLoop,
  updateDailyPlanBlockStatus,
  upsertDailyCheckin,
} from "@/lib/server/today-store";
import { getSupabaseAdminClient, isSupabaseStorageEnabled } from "@/lib/server/persistence/supabase";
import type {
  CompleteSessionInput,
  CreateAttemptInput,
  CreateSessionInput,
} from "@/lib/contracts/solve-contracts";
import type {
  PostTodayCheckinInput,
  PostTodayPlanInput,
  PostTodayProgressInput,
  PostTodayReplanInput,
  PostTodayStartInput,
} from "@/lib/contracts/today-contracts";
import type {
  CreateProblemInput,
  ProblemReviewStatusResponse,
  UpdateProblemReviewStatusInput,
} from "@/lib/contracts/problem-contracts";
import type { AnalyzeReportOutput, CreateQuickReportInput, DeepenReportInput } from "@/lib/contracts/report-contracts";

export type StorageMode = "memory" | "supabase";

export interface ProblemRepository {
  list(section?: Problem["section"]): Promise<Problem[]>;
  listByIds(problemIds: string[]): Promise<Problem[]>;
  listSolveReady(section?: Problem["section"]): Promise<Problem[]>;
  getById(problemId: string): Promise<Problem | null>;
  create(input: CreateProblemInput): Promise<Problem>;
  createImportBatch(input: {
    input_type: ProblemImportBatch["input_type"];
    source_name?: string | null;
    source_url?: string | null;
    license_note?: string | null;
    notes?: string | null;
    total_rows: number;
    created_rows: number;
    invalid_rows: number;
    duplicate_rows: number;
  }): Promise<ProblemImportBatch>;
  listImportBatches(): Promise<ProblemImportBatch[]>;
  getImportBatchById(batchId: string): Promise<ProblemImportBatch | null>;
  updateReviewStatus(input: UpdateProblemReviewStatusInput): Promise<ProblemReviewStatusResponse>;
  getReviewStatus(problem: Problem): Promise<"accepted" | "needs_review">;
  getReviewItem(problemId: string): Promise<ProblemReviewStatusResponse | null>;
  listReviewItems(input: {
    review_status?: "accepted" | "needs_review";
    curation_status?: Problem["curation_status"];
    corpus_tier?: ProblemCorpusTier;
    import_batch_id?: string;
    section?: Problem["section"];
    source?: string;
    tag?: string;
    limit?: number;
  }): Promise<{
    items: ProblemReviewStatusResponse[];
    total: number;
  }>;
}

export interface SolveRepository {
  listSessions(): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | null>;
  createSession(input: CreateSessionInput): Promise<Session>;
  completeSession(input: CompleteSessionInput): Promise<Session>;
  getSessionRunState(sessionId: string): Promise<ReturnType<typeof getSessionRunState>>;
  getSessionSolveContext(sessionId: string): Promise<ReturnType<typeof getSessionSolveContext>>;
  listAttempts(sessionId?: string): Promise<Attempt[]>;
  createAttempt(input: CreateAttemptInput): Promise<Attempt>;
  getAttemptById(attemptId: string): Promise<Attempt | null>;
}

export interface ReportRepository {
  listReports(): Promise<ErrorReport[]>;
  listRules(): Promise<Rule[]>;
  listPendingDeepReports(): Promise<ErrorReport[]>;
  getReportById(reportId: string): Promise<ErrorReport | null>;
  createQuickReport(input: CreateQuickReportInput): Promise<{
    report: ErrorReport;
    createdRule: Rule | null;
  }>;
  deepenReport(input: DeepenReportInput): Promise<ErrorReport>;
  attachAiAnalysis(reportId: string, analysis: AnalyzeReportOutput): Promise<ErrorReport>;
}

export interface ReviewQueueRepository {
  listQueue(): Promise<ReviewQueueItem[]>;
  getById(queueId: string): Promise<ReviewQueueItem | null>;
  upsert(item: ReviewQueueItem): Promise<void>;
}

export interface ReviewRepository {
  getInbox(): Promise<ReviewInboxSnapshot>;
  getReportsView(input?: {
    mode?: "quick" | "deep";
    report_id?: string;
    limit?: number;
  }): Promise<ReviewReportsSnapshot>;
}

export interface DailyRepository {
  getTodayLog(): Promise<DailyLog | null>;
  listUpcomingCalendar(days?: number): Promise<CalendarDay[]>;
}

export interface TodayRepository {
  getSnapshot(date?: string): Promise<TodaySnapshot>;
  upsertCheckin(input: PostTodayCheckinInput): Promise<DailyCheckin>;
  generatePlan(input: PostTodayPlanInput): Promise<{
    plan: DailyPlan;
    source_counts: DailyPlan["source_counts"];
    next_action: TodayNextAction;
  }>;
  replan(input: PostTodayReplanInput): Promise<{
    plan: DailyPlan;
    changed_blocks: string[];
    next_action: TodayNextAction;
  }>;
  updateProgress(input: PostTodayProgressInput): Promise<{
    plan: DailyPlan;
    changed_blocks: string[];
    next_action: TodayNextAction;
  }>;
  start(input: PostTodayStartInput): Promise<{
    checkin: DailyCheckin;
    plan: DailyPlan;
    progress: TodaySnapshot["progress"];
    next_action: TodayNextAction;
    redirect_to: string;
    resume_session_id: string | null;
    today_queue: TodaySnapshot["today_queue"];
    focus_problem_id: string | null;
    queue_counts: TodaySnapshot["queue_counts"];
  }>;
  attachSession(date: string, blockId: string, sessionId: string): Promise<DailyPlan>;
}

export interface ServerRepositories {
  storageMode: StorageMode;
  problems: ProblemRepository;
  solve: SolveRepository;
  reports: ReportRepository;
  reviewQueue: ReviewQueueRepository;
  review: ReviewRepository;
  daily: DailyRepository;
  today: TodayRepository;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mapProblemRow(row: Record<string, unknown>): Problem {
  return {
    id: String(row.id),
    section: row.section as Problem["section"],
    sub_type: String(row.sub_type),
    difficulty: (row.difficulty as Problem["difficulty"]) ?? null,
    content: asRecord(row.content),
    tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : [],
    source: toNullableString(row.source),
    source_type: (row.source_type as Problem["source_type"]) ?? null,
    source_name: toNullableString(row.source_name),
    source_url: toNullableString(row.source_url),
    external_id: toNullableString(row.external_id),
    license_note: toNullableString(row.license_note),
    parser_confidence: toNullableNumber(row.parser_confidence),
    curation_status: (row.curation_status as Problem["curation_status"]) ?? null,
    corpus_tier: (row.corpus_tier as Problem["corpus_tier"]) ?? null,
    canonical_hash: toNullableString(row.canonical_hash),
    difficulty_estimate: (row.difficulty_estimate as Problem["difficulty_estimate"]) ?? null,
    explanation_quality: toNullableNumber(row.explanation_quality),
    import_batch_id: toNullableString(row.import_batch_id),
    last_curated_at: toNullableString(row.last_curated_at),
    curated_by: toNullableString(row.curated_by),
    created_at: String(row.created_at),
  };
}

function mapProblemImportBatchRow(row: Record<string, unknown>): ProblemImportBatch {
  return {
    id: String(row.id),
    input_type: row.input_type as ProblemImportBatch["input_type"],
    source_name: toNullableString(row.source_name),
    source_url: toNullableString(row.source_url),
    license_note: toNullableString(row.license_note),
    notes: toNullableString(row.notes),
    total_rows: Number(row.total_rows ?? 0),
    created_rows: Number(row.created_rows ?? 0),
    invalid_rows: Number(row.invalid_rows ?? 0),
    duplicate_rows: Number(row.duplicate_rows ?? 0),
    created_at: String(row.created_at),
  };
}

function mapSessionRow(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    session_type: row.session_type as Session["session_type"],
    recipe: toNullableString(row.recipe),
    duration_planned_min: Number(row.duration_planned_min),
    duration_actual_min: toNullableNumber(row.duration_actual_min),
    started_at: String(row.started_at),
    completed_at: toNullableString(row.completed_at),
    meta: asRecord(row.meta),
  };
}

function mapAttemptRow(row: Record<string, unknown>): Attempt {
  return {
    id: String(row.id),
    problem_id: String(row.problem_id),
    session_id: String(row.session_id),
    user_answer: typeof row.user_answer === "number" ? row.user_answer : null,
    is_correct: Boolean(row.is_correct),
    time_spent_sec: Number(row.time_spent_sec),
    exceeded_cutoff: Boolean(row.exceeded_cutoff),
    confidence: (row.confidence as Attempt["confidence"]) ?? null,
    pre_think: (row.pre_think as Attempt["pre_think"]) ?? null,
    attempted_at: String(row.attempted_at),
  };
}

function mapReportRow(row: Record<string, unknown>): ErrorReport {
  return {
    id: String(row.id),
    attempt_id: String(row.attempt_id),
    review_queue_id: toNullableString(row.review_queue_id),
    report_mode: row.report_mode as ErrorReport["report_mode"],
    my_frame: String(row.my_frame),
    correct_mechanism: String(row.correct_mechanism),
    next_tool: String(row.next_tool),
    mechanism_english: toNullableString(row.mechanism_english),
    logic_comparison: toNullableString(row.logic_comparison),
    sub_report: (row.sub_report as ErrorReport["sub_report"]) ?? null,
    failure_stage: (row.failure_stage as ErrorReport["failure_stage"]) ?? null,
    error_type: toNullableString(row.error_type),
    ai_wrong_choices: toNullableString(row.ai_wrong_choices),
    ai_core_principle: toNullableString(row.ai_core_principle),
    ai_emotional_diary: toNullableString(row.ai_emotional_diary),
    ai_visual_concept: toNullableString(row.ai_visual_concept),
    created_at: String(row.created_at),
    deepened_at: toNullableString(row.deepened_at),
  };
}

function mapRuleRow(row: Record<string, unknown>): Rule {
  return {
    id: String(row.id),
    content: String(row.content),
    section: (row.section as Rule["section"]) ?? null,
    source_report_id: toNullableString(row.source_report_id),
    is_top20: Boolean(row.is_top20),
    created_at: String(row.created_at),
  };
}

function mapQueueRow(row: Record<string, unknown>): ReviewQueueItem {
  return {
    id: String(row.id),
    problem_id: String(row.problem_id),
    next_review_at: String(row.next_review_at),
    interval_days: Number(row.interval_days),
    ease_factor: Number(row.ease_factor),
    repetitions: Number(row.repetitions),
    priority_score: Number(row.priority_score),
    created_at: String(row.created_at),
  };
}

async function syncCanonicalStoresFromSupabase(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const [
    problemsResult,
    importBatchesResult,
    sessionsResult,
    sessionProblemsResult,
    attemptsResult,
    reportsResult,
    rulesResult,
    queueResult,
  ] = await Promise.all([
    supabase.from("problems").select("*").order("created_at", { ascending: false }),
    supabase.from("problem_import_batches").select("*").order("created_at", { ascending: false }),
    supabase.from("sessions").select("*").order("started_at", { ascending: false }),
    supabase.from("session_problems").select("*").order("position", { ascending: true }),
    supabase.from("attempts").select("*").order("attempted_at", { ascending: false }),
    supabase.from("error_reports").select("*").order("created_at", { ascending: false }),
    supabase.from("rules").select("*").order("created_at", { ascending: false }),
    supabase.from("review_queue").select("*").order("next_review_at", { ascending: true }),
  ]);

  const errors = [
    problemsResult.error,
    importBatchesResult.error,
    sessionsResult.error,
    sessionProblemsResult.error,
    attemptsResult.error,
    reportsResult.error,
    rulesResult.error,
    queueResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to sync canonical state from Supabase");
  }

  seedProblemsStore({
    problems: (problemsResult.data ?? []).map((row) => mapProblemRow(row as Record<string, unknown>)),
    import_batches: (importBatchesResult.data ?? []).map((row) =>
      mapProblemImportBatchRow(row as Record<string, unknown>),
    ),
  });

  const sessionProblems = new Map<string, string[]>();
  for (const row of sessionProblemsResult.data ?? []) {
    const record = row as Record<string, unknown>;
    const sessionId = String(record.session_id);
    const current = sessionProblems.get(sessionId) ?? [];
    current.push(String(record.problem_id));
    sessionProblems.set(sessionId, current);
  }

  seedSolveStore({
    sessions: (sessionsResult.data ?? []).map((row) => mapSessionRow(row as Record<string, unknown>)),
    attempts: (attemptsResult.data ?? []).map((row) => mapAttemptRow(row as Record<string, unknown>)),
    sessionProblems: [...sessionProblems.entries()].map(([session_id, problem_ids]) => ({
      session_id,
      problem_ids,
    })),
  });

  seedReportStore({
    reports: (reportsResult.data ?? []).map((row) => mapReportRow(row as Record<string, unknown>)),
    rules: (rulesResult.data ?? []).map((row) => mapRuleRow(row as Record<string, unknown>)),
  });

  seedQueueItems((queueResult.data ?? []).map((row) => mapQueueRow(row as Record<string, unknown>)));
}

async function upsertProblemRow(problem: Problem): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("problems").upsert({
    id: problem.id,
    section: problem.section,
    sub_type: problem.sub_type,
    difficulty: problem.difficulty,
    content: problem.content,
    tags: problem.tags,
    source: problem.source,
    source_type: problem.source_type,
    source_name: problem.source_name,
    source_url: problem.source_url,
    external_id: problem.external_id,
    license_note: problem.license_note,
    parser_confidence: problem.parser_confidence,
    curation_status: problem.curation_status,
    corpus_tier: problem.corpus_tier,
    canonical_hash: problem.canonical_hash,
    difficulty_estimate: problem.difficulty_estimate,
    explanation_quality: problem.explanation_quality,
    import_batch_id: problem.import_batch_id,
    last_curated_at: problem.last_curated_at,
    curated_by: problem.curated_by,
    created_at: problem.created_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertProblemImportBatchRow(batch: ProblemImportBatch): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("problem_import_batches").upsert({
    id: batch.id,
    input_type: batch.input_type,
    source_name: batch.source_name,
    source_url: batch.source_url,
    license_note: batch.license_note,
    notes: batch.notes,
    total_rows: batch.total_rows,
    created_rows: batch.created_rows,
    invalid_rows: batch.invalid_rows,
    duplicate_rows: batch.duplicate_rows,
    created_at: batch.created_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertSessionRow(session: Session): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("sessions").upsert({
    id: session.id,
    session_type: session.session_type,
    recipe: session.recipe,
    duration_planned_min: session.duration_planned_min,
    duration_actual_min: session.duration_actual_min,
    started_at: session.started_at,
    completed_at: session.completed_at,
    meta: session.meta,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function replaceSessionProblems(sessionId: string, problemIds: string[]): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error: deleteError } = await supabase.from("session_problems").delete().eq("session_id", sessionId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (problemIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("session_problems").insert(
    problemIds.map((problemId, index) => ({
      session_id: sessionId,
      problem_id: problemId,
      position: index,
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function upsertAttemptRow(attempt: Attempt): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("attempts").upsert({
    id: attempt.id,
    problem_id: attempt.problem_id,
    session_id: attempt.session_id,
    user_answer: attempt.user_answer,
    is_correct: attempt.is_correct,
    time_spent_sec: attempt.time_spent_sec,
    exceeded_cutoff: attempt.exceeded_cutoff,
    confidence: attempt.confidence,
    pre_think: attempt.pre_think,
    attempted_at: attempt.attempted_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertReportRow(report: ErrorReport): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("error_reports").upsert({
    id: report.id,
    attempt_id: report.attempt_id,
    review_queue_id: report.review_queue_id,
    report_mode: report.report_mode,
    my_frame: report.my_frame,
    correct_mechanism: report.correct_mechanism,
    next_tool: report.next_tool,
    mechanism_english: report.mechanism_english,
    logic_comparison: report.logic_comparison,
    sub_report: report.sub_report,
    failure_stage: report.failure_stage,
    error_type: report.error_type,
    ai_wrong_choices: report.ai_wrong_choices,
    ai_core_principle: report.ai_core_principle,
    ai_emotional_diary: report.ai_emotional_diary,
    ai_visual_concept: report.ai_visual_concept,
    created_at: report.created_at,
    deepened_at: report.deepened_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertRuleRow(rule: Rule): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("rules").upsert({
    id: rule.id,
    content: rule.content,
    section: rule.section,
    source_report_id: rule.source_report_id,
    is_top20: rule.is_top20,
    created_at: rule.created_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertQueueRow(item: ReviewQueueItem): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("review_queue").upsert({
    id: item.id,
    problem_id: item.problem_id,
    next_review_at: item.next_review_at,
    interval_days: item.interval_days,
    ease_factor: item.ease_factor,
    repetitions: item.repetitions,
    priority_score: item.priority_score,
    created_at: item.created_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function buildMemoryRepositories(storageMode: StorageMode): ServerRepositories {
  return {
    storageMode,
    problems: {
      list: async (section) => listProblems(section),
      listByIds: async (problemIds) => listProblemsByIds(problemIds),
      listSolveReady: async (section) => listSolveReadyProblems(section),
      getById: async (problemId) => getProblemById(problemId),
      create: async (input) => createProblem(input),
      createImportBatch: async (input) => createProblemImportBatch(input),
      listImportBatches: async () => listProblemImportBatches(),
      getImportBatchById: async (batchId) => getProblemImportBatchById(batchId),
      updateReviewStatus: async (input) => updateProblemReviewStatus(input),
      getReviewStatus: async (problem) => getProblemReviewStatus(problem),
      getReviewItem: async (problemId) => getProblemReviewItem(problemId),
      listReviewItems: async (input) => listProblemReviewItems({
        review_status: input.review_status,
        curation_status: input.curation_status ?? undefined,
        corpus_tier: input.corpus_tier,
        import_batch_id: input.import_batch_id,
        section: input.section,
        source: input.source,
        tag: input.tag,
        limit: input.limit ?? 50,
      }),
    },
    solve: {
      listSessions: async () => listSessions(),
      getSessionById: async (sessionId) => getSessionById(sessionId),
      createSession: async (input) => createSession(input),
      completeSession: async (input) => completeSession(input),
      getSessionRunState: async (sessionId) => getSessionRunState(sessionId),
      getSessionSolveContext: async (sessionId) => getSessionSolveContext(sessionId),
      listAttempts: async (sessionId) => listAttempts(sessionId),
      createAttempt: async (input) => createAttempt(input),
      getAttemptById: async (attemptId) => getAttemptById(attemptId),
    },
    reports: {
      listReports: async () => listReports(),
      listRules: async () => listRules(),
      listPendingDeepReports: async () => listPendingDeepReports(),
      getReportById: async (reportId) => getReportById(reportId),
      createQuickReport: async (input) => createQuickReport(input),
      deepenReport: async (input) => deepenReport(input),
      attachAiAnalysis: async (reportId, analysis) => attachAiAnalysis(reportId, analysis),
    },
    reviewQueue: {
      listQueue: async () => listQueueItems(),
      getById: async (queueId) => getQueueItem(queueId),
      upsert: async (item) => {
        upsertQueueItem(item);
      },
    },
    review: {
      getInbox: async () => getReviewInbox(),
      getReportsView: async (input) => getReviewReportsView(input),
    },
    daily: {
      getTodayLog: async () => getTodayLog(),
      listUpcomingCalendar: async (days) => ensureUpcomingCalendar(days),
    },
    today: {
      getSnapshot: async (date) => getTodaySnapshot(date),
      upsertCheckin: async (input) => upsertDailyCheckin(input),
      generatePlan: async (input) => generateDailyPlan(input),
      replan: async (input) => replanDaily(input),
      updateProgress: async (input) => updateDailyPlanBlockStatus(input),
      start: async (input) => startTodayLoop(input),
      attachSession: async (date, blockId, sessionId) => attachSessionToPlanBlock(date, blockId, sessionId),
    },
  };
}

function wrapSupabaseRepositories(): ServerRepositories {
  const memory = buildMemoryRepositories("supabase");

  return {
    ...memory,
    problems: {
      ...memory.problems,
      create: async (input) => {
        const created = createProblem(input);
        try {
          await upsertProblemRow(created);
          await syncCanonicalStoresFromSupabase();
          return getProblemById(created.id) ?? created;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
      createImportBatch: async (input) => {
        const batch = createProblemImportBatch(input);
        try {
          await upsertProblemImportBatchRow(batch);
          await syncCanonicalStoresFromSupabase();
          return getProblemImportBatchById(batch.id) ?? batch;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
      updateReviewStatus: async (input) => {
        const updated = updateProblemReviewStatus(input);
        try {
          await upsertProblemRow(updated.problem);
          await syncCanonicalStoresFromSupabase();
          return getProblemReviewItem(updated.problem.id) ?? updated;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
    },
    solve: {
      ...memory.solve,
      createSession: async (input) => {
        const session = createSession(input);
        try {
          await upsertSessionRow(session);
          await replaceSessionProblems(session.id, input.problem_ids ?? []);
          await syncCanonicalStoresFromSupabase();
          return getSessionById(session.id) ?? session;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
      completeSession: async (input) => {
        const session = completeSession(input);
        try {
          await upsertSessionRow(session);
          await syncCanonicalStoresFromSupabase();
          return getSessionById(session.id) ?? session;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
      createAttempt: async (input) => {
        const attempt = createAttempt(input);
        try {
          await upsertAttemptRow(attempt);
          await syncCanonicalStoresFromSupabase();
          return getAttemptById(attempt.id) ?? attempt;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
    },
    reports: {
      ...memory.reports,
      createQuickReport: async (input) => {
        const created = createQuickReport(input);
        try {
          await upsertReportRow(created.report);
          if (created.createdRule) {
            await upsertRuleRow(created.createdRule);
          }
          const queue = created.report.review_queue_id
            ? getQueueItem(created.report.review_queue_id)
            : null;
          if (queue) {
            await upsertQueueRow(queue);
          }
          await syncCanonicalStoresFromSupabase();
          return {
            report: getReportById(created.report.id) ?? created.report,
            createdRule: created.createdRule,
          };
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
      deepenReport: async (input) => {
        const report = deepenReport(input);
        try {
          await upsertReportRow(report);
          await syncCanonicalStoresFromSupabase();
          return getReportById(report.id) ?? report;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
      attachAiAnalysis: async (reportId, analysis) => {
        const report = attachAiAnalysis(reportId, analysis);
        try {
          await upsertReportRow(report);
          await syncCanonicalStoresFromSupabase();
          return getReportById(report.id) ?? report;
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
    },
    reviewQueue: {
      ...memory.reviewQueue,
      upsert: async (item) => {
        upsertQueueItem(item);
        try {
          await upsertQueueRow(item);
          await syncCanonicalStoresFromSupabase();
        } catch (error) {
          await syncCanonicalStoresFromSupabase();
          throw error;
        }
      },
    },
  };
}

export async function getServerRepositories(): Promise<ServerRepositories> {
  if (!isSupabaseStorageEnabled()) {
    return buildMemoryRepositories("memory");
  }

  await syncCanonicalStoresFromSupabase();
  return wrapSupabaseRepositories();
}

export async function ensureCanonicalStateLoaded(): Promise<void> {
  if (!isSupabaseStorageEnabled()) {
    return;
  }

  await syncCanonicalStoresFromSupabase();
}
