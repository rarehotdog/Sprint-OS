import type {
  CalendarDay,
  DailyCheckin,
  DailyLog,
  DailyPlan,
  ErrorReport,
  ReviewInboxSnapshot,
  ReviewReportsSnapshot,
  Problem,
  ReviewQueueItem,
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
  getProblemById,
  getProblemReviewStatus,
  listProblems,
  updateProblemReviewStatus,
} from "@/lib/server/problems-store";
import { listReports, listRules } from "@/lib/server/report-store";
import { getReviewInbox, getReviewReportsView } from "@/lib/server/review-inbox-store";
import { listQueueItems } from "@/lib/server/review-queue-store";
import {
  completeSession,
  createAttempt,
  createSession,
  getSessionById,
  getSessionSolveContext,
  getSessionRunState,
  listAttempts,
  listSessions,
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
  ParsedSectionResult,
  UpdateProblemReviewStatusInput,
} from "@/lib/contracts/problem-contracts";

export type StorageMode = "memory" | "supabase";

export interface ProblemRepository {
  list(section?: Problem["section"]): Problem[];
  getById(problemId: string): Problem | null;
  create(input: CreateProblemInput): Problem;
  updateReviewStatus(input: UpdateProblemReviewStatusInput): {
    problem: Problem;
    parser: ParsedSectionResult | null;
    review_status: "accepted" | "needs_review";
  };
  getReviewStatus(problem: Problem): "accepted" | "needs_review";
}

export interface SolveRepository {
  listSessions(): Session[];
  getSessionById(sessionId: string): Session | null;
  createSession(input: CreateSessionInput): Session;
  completeSession(input: CompleteSessionInput): Session;
  getSessionRunState(sessionId: string): ReturnType<typeof getSessionRunState>;
  getSessionSolveContext(sessionId: string): ReturnType<typeof getSessionSolveContext>;
  listAttempts(sessionId?: string): Attempt[];
  createAttempt(input: CreateAttemptInput): Attempt;
}

export interface ReportRepository {
  listReports(): ErrorReport[];
  listRules(): Rule[];
}

export interface ReviewQueueRepository {
  listQueue(): ReviewQueueItem[];
}

export interface ReviewRepository {
  getInbox(): ReviewInboxSnapshot;
  getReportsView(input?: {
    mode?: "quick" | "deep";
    report_id?: string;
    limit?: number;
  }): ReviewReportsSnapshot;
}

export interface DailyRepository {
  getTodayLog(): DailyLog | null;
  listUpcomingCalendar(days?: number): CalendarDay[];
}

export interface TodayRepository {
  getSnapshot(date?: string): TodaySnapshot;
  upsertCheckin(input: PostTodayCheckinInput): DailyCheckin;
  generatePlan(input: PostTodayPlanInput): {
    plan: DailyPlan;
    source_counts: DailyPlan["source_counts"];
    next_action: TodayNextAction;
  };
  replan(input: PostTodayReplanInput): {
    plan: DailyPlan;
    changed_blocks: string[];
    next_action: TodayNextAction;
  };
  updateProgress(input: PostTodayProgressInput): {
    plan: DailyPlan;
    changed_blocks: string[];
    next_action: TodayNextAction;
  };
  start(input: PostTodayStartInput): {
    checkin: DailyCheckin;
    plan: DailyPlan;
    progress: TodaySnapshot["progress"];
    next_action: TodayNextAction;
    redirect_to: string;
  };
  attachSession(date: string, blockId: string, sessionId: string): DailyPlan;
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

export function getServerRepositories(): ServerRepositories {
  return {
    storageMode: "memory",
    problems: {
      list: (section) => listProblems(section),
      getById: (problemId) => getProblemById(problemId),
      create: (input) => createProblem(input),
      updateReviewStatus: (input) => updateProblemReviewStatus(input),
      getReviewStatus: (problem) => getProblemReviewStatus(problem),
    },
    solve: {
      listSessions,
      getSessionById,
      createSession,
      completeSession,
      getSessionRunState,
      getSessionSolveContext,
      listAttempts,
      createAttempt,
    },
    reports: {
      listReports,
      listRules,
    },
    reviewQueue: {
      listQueue: listQueueItems,
    },
    review: {
      getInbox: getReviewInbox,
      getReportsView: getReviewReportsView,
    },
    daily: {
      getTodayLog,
      listUpcomingCalendar: ensureUpcomingCalendar,
    },
    today: {
      getSnapshot: (date) => getTodaySnapshot(date),
      upsertCheckin: (input) => upsertDailyCheckin(input),
      generatePlan: (input) => generateDailyPlan(input),
      replan: (input) => replanDaily(input),
      updateProgress: (input) => updateDailyPlanBlockStatus(input),
      start: (input) => startTodayLoop(input),
      attachSession: (date, blockId, sessionId) => attachSessionToPlanBlock(date, blockId, sessionId),
    },
  };
}
