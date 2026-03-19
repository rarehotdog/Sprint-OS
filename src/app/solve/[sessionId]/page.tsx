"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import {
  buildAutoDeepenPayload,
  buildConceptSupportCard,
  buildMicroQuickDraft,
  buildQuickReportPayload,
  buildSolveRecoverySnapshot,
  getSolveEmptyState,
  getSolveReviewDestination,
  mapAttemptToRecall,
  MICRO_QUICK_ERROR_TYPE_OPTIONS,
  MICRO_QUICK_NEXT_TOOL_OPTIONS,
  parseSolveQueryFallbacks,
  resolveSolveSubmission,
  shouldAutoDeepenAttempt,
  type ConceptSupportCard,
  type MicroQuickFormState,
} from "@/lib/solve-ui";
import type {
  Attempt,
  Confidence,
  DeepenReportResponse,
  Problem,
  SessionDetailResponse,
  TodayQueueItemSource,
} from "@/lib/types";

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function asAnswerIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  return null;
}

function formatSectionLabel(section: Problem["section"] | null): string {
  if (section === "verbal") return "Verbal";
  if (section === "quant") return "Quant";
  if (section === "di") return "DI";
  return "-";
}

function formatConfidenceLabel(confidence: Confidence | null): string {
  if (confidence === "sure") return "확신";
  if (confidence === "unsure") return "애매";
  if (confidence === "guessed") return "찍음";
  return "미선택";
}

function formatResultLabel(isCorrect: boolean): string {
  return isCorrect ? "정답" : "오답";
}

function readQueueMeta(
  detail: SessionDetailResponse | null,
  problemId: string | null,
): {
  source: TodayQueueItemSource;
  review_queue_id: string | null;
} | null {
  if (!detail || !problemId) {
    return null;
  }

  const raw = (detail.session.meta as { today_queue?: unknown }).today_queue;
  if (!Array.isArray(raw)) {
    return null;
  }

  const match = raw.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    return (item as Record<string, unknown>).problem_id === problemId;
  });

  if (!match || typeof match !== "object") {
    return null;
  }

  const record = match as Record<string, unknown>;
  const source =
    record.source === "due_review" || record.source === "new" ? record.source : "new";

  return {
    source,
    review_queue_id: typeof record.review_queue_id === "string" ? record.review_queue_id : null,
  };
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "요청 처리에 실패했습니다.";
    throw new Error(message);
  }

  return payload as T;
}

interface SubmittedAttemptContext {
  attempt: Attempt;
  problem: Problem;
  queueSource: TodayQueueItemSource;
  reviewQueueId: string | null;
}

function SolveSessionPageContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selfReportedCorrect, setSelfReportedCorrect] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [problemStartedAt, setProblemStartedAt] = useState<number>(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<SubmittedAttemptContext | null>(null);
  const [microQuick, setMicroQuick] = useState<MicroQuickFormState>({
    error_type: "",
    next_tool: "",
    one_line_note: "",
  });
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  const [conceptSupport, setConceptSupport] = useState<ConceptSupportCard | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setIsLoading(true);
      setError(null);

      try {
        const sessionPayload = await readJson<SessionDetailResponse>(
          `/api/sessions?session_id=${encodeURIComponent(sessionId)}`,
        );

        let nextProblems: Problem[] = [];
        if (sessionPayload.run_state.ordered_problem_ids.length > 0) {
          const problemsPayload = await readJson<{ problems: Problem[] }>(
            `/api/problems?problem_ids=${sessionPayload.run_state.ordered_problem_ids.join(",")}`,
          );
          nextProblems = problemsPayload.problems;
        }

        if (!cancelled) {
          setDetail(sessionPayload);
          setProblems(nextProblems);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "세션 복구에 실패했습니다.");
          setDetail(null);
          setProblems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const fallbacks = parseSolveQueryFallbacks(searchParams);
  const recovery = detail ? buildSolveRecoverySnapshot(detail, problems, fallbacks) : null;
  const activeProblem = recovery?.activeProblem ?? null;
  const answerIndex = asAnswerIndex(activeProblem?.content.answer_index);
  const canSubmit =
    answerIndex !== null ? selectedAnswer !== null : selfReportedCorrect !== null;

  useEffect(() => {
    if (!recovery?.activeProblemId || submittedAttempt) {
      return;
    }

    setSelectedAnswer(null);
    setSelfReportedCorrect(null);
    setConfidence(null);
    setProblemStartedAt(Date.now());
  }, [recovery?.activeProblemId, submittedAttempt]);

  async function handleSubmit() {
    if (!detail || !recovery?.activeProblemId || !activeProblem) {
      return;
    }

    const submission = resolveSolveSubmission({
      answerIndex,
      selectedAnswer,
      selfReportedCorrect,
    });

    if (submission.error || submission.isCorrect === null) {
      setError(submission.error ?? "제출 조건을 확인해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setConceptSupport(null);

    try {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - problemStartedAt) / 1000));
      const payload = await readJson<{
        attempt: Attempt;
        run_state: SessionDetailResponse["run_state"];
      }>("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem_id: recovery.activeProblemId,
          session_id: sessionId,
          user_answer: selectedAnswer,
          is_correct: submission.isCorrect,
          time_spent_sec: elapsedSeconds,
          confidence,
        }),
      });

      setDetail((current) =>
        current
          ? {
              ...current,
              run_state: payload.run_state,
            }
          : current,
      );

      const queueMeta = readQueueMeta(detail, activeProblem.id);
      setSubmittedAttempt({
        attempt: payload.attempt,
        problem: activeProblem,
        queueSource: queueMeta?.source ?? "new",
        reviewQueueId: queueMeta?.review_queue_id ?? null,
      });
      setMicroQuick(buildMicroQuickDraft(payload.attempt, activeProblem));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "제출 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function triggerAutoDeep(
    attemptContext: SubmittedAttemptContext,
    reportId: string,
    quickPayload: ReturnType<typeof buildQuickReportPayload>,
  ) {
    const deepPayload = buildAutoDeepenPayload({
      report_id: reportId,
      attempt: attemptContext.attempt,
      problem: attemptContext.problem,
      quickReport: quickPayload,
    });

    try {
      const response = await readJson<DeepenReportResponse>("/api/reports/deepen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deepPayload),
      });
      setConceptSupport(buildConceptSupportCard(response, quickPayload));
      return;
    } catch {
      // Retry once without AI so the learner loop stays non-blocking.
    }

    try {
      const response = await readJson<DeepenReportResponse>("/api/reports/deepen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...deepPayload,
          generate_ai: false,
        }),
      });
      setConceptSupport(buildConceptSupportCard(response, quickPayload));
    } catch {
      // Preserve quick-save success even when deepen cannot complete.
    }
  }

  async function handleSaveQuick() {
    if (!submittedAttempt) {
      return;
    }

    if (!microQuick.error_type || !microQuick.next_tool) {
      setError("Micro Quick에서 error type과 next tool을 먼저 고르세요.");
      return;
    }

    setIsSavingQuick(true);
    setError(null);

    const attemptContext = submittedAttempt;
    const quickPayload = buildQuickReportPayload({
      attempt: attemptContext.attempt,
      problem: attemptContext.problem,
      microQuick,
    });

    try {
      const created = await readJson<{ report: { id: string; review_queue_id: string | null } }>("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: attemptContext.attempt.id,
          my_frame: quickPayload.my_frame,
          correct_mechanism: quickPayload.correct_mechanism,
          next_tool: quickPayload.next_tool,
          failure_stage: quickPayload.failure_stage,
          error_type: quickPayload.error_type,
          save_as_rule: false,
        }),
      });

      setSubmittedAttempt(null);

      if (attemptContext.reviewQueueId) {
        void readJson("/api/ai/review-queue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            review_queue_id: attemptContext.reviewQueueId,
            recall: mapAttemptToRecall(attemptContext.attempt),
          }),
        }).catch(() => undefined);
      }

      if (shouldAutoDeepenAttempt(attemptContext.attempt)) {
        void triggerAutoDeep(attemptContext, created.report.id, quickPayload);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Quick 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingQuick(false);
    }
  }

  const reviewDestination = detail
    ? getSolveReviewDestination(sessionId, detail.run_state)
    : null;
  const emptyState = getSolveEmptyState(detail);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Solve Runner</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Session {sessionId.slice(0, 8)}</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                현재 문항 위치는 서버에 저장된 <code>run_state + solve_context</code> 기준으로 복구됩니다.
              </p>
            </div>
            {recovery ? (
              <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300 sm:text-right">
                <span>문항</span>
                <span>
                  {recovery.questionNumber ?? "-"} / {recovery.totalCount}
                </span>
                <span>섹션</span>
                <span>{formatSectionLabel(recovery.currentSection)}</span>
                <span>계획 시간</span>
                <span>{recovery.durationMinutes ? `${recovery.durationMinutes}분` : "-"}</span>
              </div>
            ) : null}
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            세션과 문제 순서를 서버에서 복구하는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {conceptSupport ? (
          <section className="rounded-3xl border border-emerald-300/30 bg-emerald-500/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Concept Support</p>
                <h2 className="mt-2 text-xl font-semibold">다음 문제 전에 이것만 잠깐 고정하세요</h2>
              </div>
              <button
                type="button"
                onClick={() => setConceptSupport(null)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-100"
              >
                닫기
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-zinc-100">
              <p><span className="text-zinc-400">핵심 메커니즘:</span> {conceptSupport.mechanism}</p>
              <p><span className="text-zinc-400">프레임 교정:</span> {conceptSupport.frame_shift}</p>
              <p><span className="text-zinc-400">다음 체크포인트:</span> {conceptSupport.checkpoint}</p>
            </div>
          </section>
        ) : null}

        {!isLoading && emptyState ? (
          <section className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6">
            <h2 className="text-xl font-semibold">{emptyState.title}</h2>
            <p className="mt-2 text-sm text-zinc-100">{emptyState.description}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
                Today Queue로 돌아가기
              </Link>
              <Link href={emptyState.problemsHref} className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100">
                starter 문제 준비
              </Link>
            </div>
          </section>
        ) : null}

        {!isLoading && !emptyState && detail?.run_state.completed && !submittedAttempt && reviewDestination ? (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6">
            <h2 className="text-xl font-semibold">오늘 큐를 모두 마쳤습니다.</h2>
            <p className="mt-2 text-sm text-zinc-200">{reviewDestination.description}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={reviewDestination.href}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
              >
                {reviewDestination.label}
              </Link>
              <Link
                href={`/solve/${sessionId}/review`}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100"
              >
                fallback review page 보기
              </Link>
            </div>
          </section>
        ) : null}

        {!isLoading && !emptyState && detail && recovery && activeProblem && !submittedAttempt && !detail.run_state.completed ? (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">{activeProblem.sub_type}</p>
                  <h2 className="text-2xl font-semibold">
                    Question {recovery.questionNumber ?? recovery.activeIndex + 1}
                  </h2>
                </div>
                <div className="text-right text-sm text-zinc-400">
                  <p>
                    진행 {detail.run_state.attempted_count} / {detail.run_state.total_count}
                  </p>
                  <p>{detail.run_state.next_problem_id ? "다음 문항 준비됨" : "이 문제가 마지막 문항"}</p>
                </div>
              </div>

              {asString(activeProblem.content.passage) ? (
                <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-zinc-300">
                  {asString(activeProblem.content.passage)}
                </div>
              ) : null}

              <div className="space-y-4">
                <p className="text-lg leading-8">{asString(activeProblem.content.stem) ?? "문항 본문이 없습니다."}</p>
                <div className="grid gap-3">
                  {asStringArray(activeProblem.content.choices).map((choice, index) => {
                    const isSelected = selectedAnswer === index;

                    return (
                      <button
                        key={`${activeProblem.id}-${index}`}
                        type="button"
                        onClick={() => setSelectedAnswer(index)}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          isSelected
                            ? "border-cyan-300 bg-cyan-400/10 text-white"
                            : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/30"
                        }`}
                      >
                        <span className="mr-3 font-mono text-zinc-500">{String.fromCharCode(65 + index)}.</span>
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold">제출</h3>
              <p className="mt-2 text-sm text-zinc-300">
                제출 후에는 같은 화면에서 Micro Quick를 저장하고 다음 문항으로 바로 이어갑니다.
              </p>

              {answerIndex === null ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelfReportedCorrect(true)}
                    className={`rounded-full px-4 py-2 text-sm ${
                      selfReportedCorrect ? "bg-emerald-400 text-black" : "border border-white/20"
                    }`}
                  >
                    맞음
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelfReportedCorrect(false)}
                    className={`rounded-full px-4 py-2 text-sm ${
                      selfReportedCorrect === false ? "bg-rose-300 text-black" : "border border-white/20"
                    }`}
                  >
                    틀림
                  </button>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {(["sure", "unsure", "guessed"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setConfidence(value)}
                    className={`rounded-full px-4 py-2 text-sm ${
                      confidence === value ? "bg-white text-black" : "border border-white/20 text-zinc-300"
                    }`}
                  >
                    {formatConfidenceLabel(value)}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !canSubmit}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "저장 중..." : "이 문제 제출"}
                </button>
                <Link
                  href={`/solve/${sessionId}/review`}
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-zinc-200"
                >
                  fallback review page
                </Link>
              </div>
            </section>
          </>
        ) : null}

        {!isLoading && submittedAttempt ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Micro Quick</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {formatResultLabel(submittedAttempt.attempt.is_correct)} · {submittedAttempt.problem.sub_type}
                </h2>
                <p className="mt-2 text-sm text-zinc-300">
                  Quick를 저장하면 같은 runner 안에서 다음 문항으로 자동 이동합니다.
                </p>
              </div>
              <div className="text-sm text-zinc-400 sm:text-right">
                <p>{submittedAttempt.attempt.time_spent_sec}s</p>
                <p>{formatConfidenceLabel(submittedAttempt.attempt.confidence)}</p>
                <p>{submittedAttempt.queueSource === "due_review" ? "due review" : "new problem"}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              <div>
                <p className="text-sm text-zinc-300">Error Type</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {MICRO_QUICK_ERROR_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMicroQuick((current) => ({ ...current, error_type: option.value }))}
                      className={`rounded-full px-4 py-2 text-sm ${
                        microQuick.error_type === option.value
                          ? "bg-white text-black"
                          : "border border-white/20 text-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-zinc-300">Next Tool</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {MICRO_QUICK_NEXT_TOOL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMicroQuick((current) => ({ ...current, next_tool: option.value }))}
                      className={`rounded-full px-4 py-2 text-sm ${
                        microQuick.next_tool === option.value
                          ? "bg-cyan-300 text-black"
                          : "border border-white/20 text-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">One-line Note</span>
                <textarea
                  value={microQuick.one_line_note}
                  onChange={(event) =>
                    setMicroQuick((current) => ({ ...current, one_line_note: event.target.value }))
                  }
                  rows={2}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveQuick()}
                disabled={isSavingQuick}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingQuick ? "저장 중..." : "Quick 저장하고 다음 문제로"}
              </button>
              <Link
                href={`/solve/${sessionId}/review`}
                className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-zinc-200"
              >
                자세한 fallback review
              </Link>
            </div>
          </section>
        ) : null}

        {!isLoading && !emptyState && detail && !activeProblem && !detail.run_state.completed ? (
          <section className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6 text-zinc-100">
            ordered_problem_ids는 있지만 현재 복구 가능한 문제 데이터를 찾지 못했습니다.
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default function SolveSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 text-zinc-300">
            solve runner를 준비하는 중입니다.
          </main>
        </div>
      }
    >
      <SolveSessionPageContent />
    </Suspense>
  );
}
