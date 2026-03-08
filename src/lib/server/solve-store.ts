import type {
  CompleteSessionInput,
  CreateAttemptInput,
  CreateSessionInput,
} from "@/lib/contracts/solve-contracts";
import type { Attempt, Section, Session, SessionSectionBound, SessionSolveContext } from "@/lib/types";

interface SolveDb {
  sessions: Map<string, Session>;
  attempts: Map<string, Attempt>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatSolveDb__: SolveDb | undefined;
}

function getSolveDb(): SolveDb {
  if (!global.__gmatSolveDb__) {
    global.__gmatSolveDb__ = {
      sessions: new Map<string, Session>(),
      attempts: new Map<string, Attempt>(),
    };
  }

  return global.__gmatSolveDb__;
}

function now(): string {
  return new Date().toISOString();
}

export function listSessions(): Session[] {
  return Array.from(getSolveDb().sessions.values()).sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  );
}

export function createSession(input: CreateSessionInput): Session {
  const orderedProblemIds = Array.isArray(input.problem_ids) ? input.problem_ids : [];
  const session: Session = {
    id: crypto.randomUUID(),
    session_type: input.session_type,
    recipe: input.recipe ?? null,
    duration_planned_min: input.duration_planned_min,
    duration_actual_min: null,
    started_at: now(),
    completed_at: null,
    meta: {
      ...(input.meta ?? {}),
      ordered_problem_ids: orderedProblemIds,
    },
  };

  getSolveDb().sessions.set(session.id, session);
  return session;
}

export function getSessionById(sessionId: string): Session | null {
  return getSolveDb().sessions.get(sessionId) ?? null;
}

export function listAttempts(sessionId?: string): Attempt[] {
  const attempts = Array.from(getSolveDb().attempts.values()).sort((a, b) =>
    b.attempted_at.localeCompare(a.attempted_at),
  );

  if (!sessionId) {
    return attempts;
  }

  return attempts.filter((attempt) => attempt.session_id === sessionId);
}

export function createAttempt(input: CreateAttemptInput): Attempt {
  if (!getSessionById(input.session_id)) {
    throw new Error("Session not found");
  }

  const attempt: Attempt = {
    id: crypto.randomUUID(),
    problem_id: input.problem_id,
    session_id: input.session_id,
    user_answer: input.user_answer,
    is_correct: input.is_correct,
    time_spent_sec: input.time_spent_sec,
    exceeded_cutoff: input.exceeded_cutoff,
    confidence: input.confidence,
    pre_think: (input.pre_think ?? null) as Attempt["pre_think"],
    attempted_at: now(),
  };

  getSolveDb().attempts.set(attempt.id, attempt);
  return attempt;
}

export function getAttemptById(attemptId: string): Attempt | null {
  return getSolveDb().attempts.get(attemptId) ?? null;
}

function readOrderedProblemIds(session: Session): string[] {
  const raw = (session.meta as { ordered_problem_ids?: unknown }).ordered_problem_ids;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((value): value is string => typeof value === "string");
}

function asSection(value: unknown): Section | null {
  if (value === "verbal" || value === "quant" || value === "di") {
    return value;
  }
  return null;
}

function readSectionOrder(session: Session): Section[] {
  const raw = (session.meta as { section_order?: unknown }).section_order;
  if (!Array.isArray(raw)) {
    const hint = inferSectionHint(session);
    return hint ? [hint] : [];
  }

  const parsed = raw.map(asSection).filter((section): section is Section => section !== null);
  if (parsed.length > 0) {
    return parsed;
  }

  const hint = inferSectionHint(session);
  return hint ? [hint] : [];
}

function readSectionBounds(session: Session): SessionSectionBound[] {
  const raw = (session.meta as { section_bounds?: unknown }).section_bounds;
  if (!Array.isArray(raw)) {
    const orderedProblemIds = readOrderedProblemIds(session);
    const hint = inferSectionHint(session);
    if (!hint || orderedProblemIds.length === 0) {
      return [];
    }

    return [{ section: hint, start_index: 0, end_index: orderedProblemIds.length }];
  }

  const bounds = raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const section = asSection(record.section);
      const startIndex = typeof record.start_index === "number" ? record.start_index : null;
      const endIndex = typeof record.end_index === "number" ? record.end_index : null;
      if (
        !section ||
        startIndex === null ||
        endIndex === null ||
        !Number.isInteger(startIndex) ||
        !Number.isInteger(endIndex) ||
        startIndex < 0 ||
        endIndex < 0
      ) {
        return null;
      }

      return {
        section,
        start_index: startIndex,
        end_index: endIndex,
      };
    })
    .filter((item): item is SessionSectionBound => item !== null);

  if (bounds.length > 0) {
    return bounds;
  }

  const orderedProblemIds = readOrderedProblemIds(session);
  const hint = inferSectionHint(session);
  if (!hint || orderedProblemIds.length === 0) {
    return [];
  }

  return [{ section: hint, start_index: 0, end_index: orderedProblemIds.length }];
}

function inferSectionHint(session: Session): Section | null {
  const meta = session.meta as Record<string, unknown>;
  const fromMeta = asSection(meta.section);
  if (fromMeta) {
    return fromMeta;
  }

  if (session.session_type === "sprint_verbal") return "verbal";
  if (session.session_type === "sprint_quant") return "quant";
  if (session.session_type === "sprint_di") return "di";

  const sectionOrder = Array.isArray(meta.section_order)
    ? meta.section_order.map(asSection).filter((section): section is Section => section !== null)
    : [];
  return sectionOrder[0] ?? null;
}

export interface SessionRunState {
  session_id: string;
  ordered_problem_ids: string[];
  attempted_problem_ids: string[];
  attempted_count: number;
  total_count: number;
  current_index: number;
  next_problem_id: string | null;
  completed: boolean;
}

export function getSessionRunState(sessionId: string): SessionRunState | null {
  const session = getSessionById(sessionId);
  if (!session) {
    return null;
  }

  const orderedProblemIds = readOrderedProblemIds(session);
  const attempts = listAttempts(sessionId);
  const attemptedProblemIds = Array.from(new Set(attempts.map((attempt) => attempt.problem_id)));
  const sessionMarkedComplete = session.completed_at !== null;

  if (orderedProblemIds.length === 0) {
    return {
      session_id: session.id,
      ordered_problem_ids: [],
      attempted_problem_ids: attemptedProblemIds,
      attempted_count: attemptedProblemIds.length,
      total_count: 0,
      current_index: 0,
      next_problem_id: null,
      completed: sessionMarkedComplete,
    };
  }

  const attemptedSet = new Set(attemptedProblemIds);
  const firstPendingIndex = orderedProblemIds.findIndex((problemId) => !attemptedSet.has(problemId));
  const attemptedCount = orderedProblemIds.filter((problemId) => attemptedSet.has(problemId)).length;
  const completed = sessionMarkedComplete || firstPendingIndex === -1;
  const currentIndex = completed
    ? Math.max(Math.min(attemptedCount, orderedProblemIds.length) - 1, 0)
    : firstPendingIndex;
  const nextProblemId = completed ? null : orderedProblemIds[currentIndex] ?? null;

  return {
    session_id: session.id,
    ordered_problem_ids: orderedProblemIds,
    attempted_problem_ids: attemptedProblemIds,
    attempted_count: attemptedCount,
    total_count: orderedProblemIds.length,
    current_index: currentIndex,
    next_problem_id: nextProblemId,
    completed,
  };
}

export function getSessionSolveContext(sessionId: string): SessionSolveContext | null {
  const session = getSessionById(sessionId);
  if (!session) {
    return null;
  }

  return {
    section_hint: inferSectionHint(session),
    duration_planned_min: session.duration_planned_min,
    section_order: readSectionOrder(session),
    section_bounds: readSectionBounds(session),
  };
}

export function completeSession(input: CompleteSessionInput): Session {
  const session = getSessionById(input.session_id);
  if (!session) {
    throw new Error("Session not found");
  }

  const updated: Session = {
    ...session,
    completed_at: input.completed_at ?? now(),
    duration_actual_min:
      input.duration_actual_min ??
      Math.max(
        1,
        Math.round(
          listAttempts(session.id).reduce((sum, attempt) => sum + attempt.time_spent_sec, 0) / 60,
        ),
      ),
  };

  getSolveDb().sessions.set(updated.id, updated);
  return updated;
}

export function resetSolveStoreForTests(): void {
  global.__gmatSolveDb__ = {
    sessions: new Map<string, Session>(),
    attempts: new Map<string, Attempt>(),
  };
}
