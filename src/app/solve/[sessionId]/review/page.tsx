"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { buildQuickReportDraft, getSolveReviewDestination } from "@/lib/solve-ui";
import type { Attempt, FailureStage, Problem, SessionDetailResponse } from "@/lib/types";

const EMPTY_QUICK_REPORT_FORM = {
  my_frame: "",
  correct_mechanism: "",
  next_tool: "",
  failure_stage: "strategy" as FailureStage,
  error_type: "",
  save_as_rule: false,
};

function formatFailureStageLabel(stage: FailureStage): string {
  if (stage === "reading") return "읽기";
  if (stage === "strategy") return "전략";
  if (stage === "calculation") return "계산";
  if (stage === "verification") return "검산";
  return "시간 압박";
}

function formatAttemptResult(attempt: Attempt | null): string {
  if (!attempt) {
    return "시도 기록 없음";
  }

  return attempt.is_correct ? "정답" : "오답";
}

function formatConfidenceLabel(value: Attempt["confidence"]): string {
  if (value === "sure") return "확신";
  if (value === "unsure") return "애매";
  if (value === "guessed") return "찍음";
  return "미선택";
}

export default function SolveSessionReviewPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<Attempt | null>(null);
  const [latestProblem, setLatestProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_QUICK_REPORT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/sessions?session_id=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "세션 상태를 불러오지 못했습니다.");
        }

        const attemptsResponse = await fetch(
          `/api/attempts?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const attemptsPayload = await attemptsResponse.json().catch(() => null);

        if (!attemptsResponse.ok) {
          throw new Error(attemptsPayload?.error ?? "세션 시도 기록을 불러오지 못했습니다.");
        }

        const latest = ((attemptsPayload?.attempts ?? []) as Attempt[])[0] ?? null;
        let problem: Problem | null = null;

        if (latest?.problem_id) {
          const problemResponse = await fetch(
            `/api/problems?problem_ids=${latest.problem_id}`,
            { cache: "no-store" },
          );
          const problemPayload = await problemResponse.json().catch(() => null);

          if (!problemResponse.ok) {
            throw new Error(problemPayload?.error ?? "방금 푼 문제를 불러오지 못했습니다.");
          }

          problem = (((problemPayload?.problems ?? []) as Problem[])[0] ?? null);
        }

        if (!cancelled) {
          setDetail(payload as SessionDetailResponse);
          setLatestAttempt(latest);
          setLatestProblem(problem);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.");
          setDetail(null);
          setLatestAttempt(null);
          setLatestProblem(null);
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

  useEffect(() => {
    if (!latestAttempt) {
      setForm(EMPTY_QUICK_REPORT_FORM);
      return;
    }

    setForm(buildQuickReportDraft(latestAttempt, latestProblem));
  }, [latestAttempt, latestProblem]);

  async function handleCreateQuickReport() {
    if (!latestAttempt) {
      setError("리포트를 생성할 최근 attempt가 없습니다.");
      return;
    }

    if (
      !form.my_frame.trim() ||
      !form.correct_mechanism.trim() ||
      !form.next_tool.trim() ||
      !form.error_type.trim()
    ) {
      setError("Quick 리포트의 필수 항목을 모두 채워주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: latestAttempt.id,
          my_frame: form.my_frame,
          correct_mechanism: form.correct_mechanism,
          next_tool: form.next_tool,
          failure_stage: form.failure_stage,
          error_type: form.error_type,
          save_as_rule: form.save_as_rule,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Quick 리포트 저장에 실패했습니다.");
      }

      setCreatedReportId(payload?.report?.id ?? null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "리포트 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const destination = detail ? getSolveReviewDestination(sessionId, detail.run_state) : null;
  const hasAttemptContext = Boolean(latestAttempt);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Solve Review Branch</p>
          <h1 className="mt-3 text-3xl font-semibold">Session Review</h1>
          <p className="mt-2 text-sm text-zinc-300">
            여기서는 쿼리값이 아니라 세션 완료 여부만 보고 다음 액션을 고정합니다.
          </p>
        </header>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            서버 상태를 확인하는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {detail && destination ? (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                <p>세션 상태: {detail.run_state.completed ? "완료" : "진행 중"}</p>
                <p>진행: {detail.run_state.attempted_count} / {detail.run_state.total_count}</p>
                <p>현재 위치: {detail.run_state.current_index + 1}번</p>
                <p>다음 이동: {detail.run_state.next_problem_id ? "다음 문제 복귀" : "요약집 이동"}</p>
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                <p className="text-sm text-zinc-100">{destination.description}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={destination.href}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
                >
                  {destination.label}
                </Link>
                <Link
                  href="/review"
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-zinc-200"
                >
                  Review Inbox 보기
                </Link>
              </div>
            </section>

            {!hasAttemptContext ? (
              <section className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6">
                <h2 className="text-xl font-semibold">아직 복기할 attempt가 없습니다.</h2>
                <p className="mt-2 text-sm text-zinc-100">
                  Quick Report는 최소 한 문제 이상 제출한 뒤에 작성할 수 있습니다. solve로 돌아가 한 문제를 풀고 다시 들어오세요.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/solve/${sessionId}`}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    solve로 돌아가기
                  </Link>
                  <Link
                    href="/"
                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100"
                  >
                    Today Hub 보기
                  </Link>
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Quick Report</h2>
                    <p className="mt-2 text-sm text-zinc-300">
                      방금 푼 문제 문맥을 바탕으로 초안을 먼저 채워뒀습니다. 바로 다듬어서 저장하면 report workbench에서 answer flow, summary card, review queue로 이어집니다.
                    </p>
                  </div>
                  {latestAttempt ? (
                    <div className="text-right text-xs text-zinc-500">
                      <p>{formatAttemptResult(latestAttempt)}</p>
                      <p>{latestAttempt.time_spent_sec}s / {formatConfidenceLabel(latestAttempt.confidence)}</p>
                    </div>
                  ) : null}
                </div>

                {latestProblem ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {latestProblem.section} / {latestProblem.sub_type}
                    </p>
                    <p className="mt-3 text-sm text-zinc-100">
                      {typeof latestProblem.content.stem === "string"
                        ? latestProblem.content.stem
                        : "문항 본문 없음"}
                    </p>
                    <p className="mt-3 text-xs text-zinc-400">
                      결과 {formatAttemptResult(latestAttempt)} / 시간 {latestAttempt?.time_spent_sec ?? "-"}초 / 확신도{" "}
                      {formatConfidenceLabel(latestAttempt?.confidence ?? null)}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-zinc-300">내가 본 프레임</span>
                    <textarea
                      value={form.my_frame}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, my_frame: event.target.value }))
                      }
                      rows={3}
                      placeholder="내가 무엇을 보고 어떻게 판단했는지 짧게 적어주세요."
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-zinc-300">정답 메커니즘</span>
                    <textarea
                      value={form.correct_mechanism}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, correct_mechanism: event.target.value }))
                      }
                      rows={3}
                      placeholder="정답이 성립하는 핵심 원리나 비교 기준을 적어주세요."
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-zinc-300">다음 도구</span>
                    <textarea
                      value={form.next_tool}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, next_tool: event.target.value }))
                      }
                      rows={2}
                      placeholder="다음에 같은 실수를 막기 위해 쓸 체크 문장이나 rule을 적어주세요."
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm text-zinc-300">실패 단계</span>
                      <select
                        value={form.failure_stage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            failure_stage: event.target.value as FailureStage,
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                      >
                        <option value="reading">{formatFailureStageLabel("reading")}</option>
                        <option value="strategy">{formatFailureStageLabel("strategy")}</option>
                        <option value="calculation">{formatFailureStageLabel("calculation")}</option>
                        <option value="verification">{formatFailureStageLabel("verification")}</option>
                        <option value="time_pressure">{formatFailureStageLabel("time_pressure")}</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-zinc-300">에러 타입</span>
                      <input
                        value={form.error_type}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, error_type: event.target.value }))
                        }
                        placeholder="예: careless_check, assumption_miss"
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-3 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.save_as_rule}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, save_as_rule: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-black/20"
                    />
                    다음 도구를 rule로도 저장
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCreateQuickReport()}
                      disabled={isSubmitting || !latestAttempt}
                      className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "저장 중..." : "Quick Report 저장"}
                    </button>
                    {createdReportId ? (
                      <Link
                        href={`/review/reports?report_id=${createdReportId}`}
                        className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-zinc-200"
                      >
                        저장된 리포트 열기
                      </Link>
                    ) : null}
                  </div>
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
