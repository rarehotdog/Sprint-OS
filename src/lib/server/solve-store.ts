import type { CreateAttemptInput, CreateSessionInput } from "@/lib/contracts/solve-contracts";
import type { Attempt, Session } from "@/lib/types";

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
  const session: Session = {
    id: crypto.randomUUID(),
    session_type: input.session_type,
    recipe: input.recipe,
    duration_planned_min: input.duration_planned_min,
    duration_actual_min: null,
    started_at: now(),
    completed_at: null,
    meta: input.meta,
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

export function resetSolveStoreForTests(): void {
  global.__gmatSolveDb__ = {
    sessions: new Map<string, Session>(),
    attempts: new Map<string, Attempt>(),
  };
}
