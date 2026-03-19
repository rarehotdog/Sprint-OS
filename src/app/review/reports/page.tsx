"use client";

import Link from "next/link";
import { Suspense, startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  buildReviewReportsHref,
  getPreferredReportId,
  normalizeReviewMode,
  parseReviewLimit,
} from "@/lib/review-ui";
import type { ReviewReportsSnapshot } from "@/lib/types";

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReviewReportsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedReportId = searchParams.get("report_id");
  const mode = normalizeReviewMode(searchParams.get("mode"));
  const limit = parseReviewLimit(searchParams.get("limit"));

  const [snapshot, setSnapshot] = useState<ReviewReportsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setIsLoading(true);
      setError(null);

      try {
        const href = buildReviewReportsHref({
          mode,
          reportId: requestedReportId,
          limit,
        });
        const response = await fetch(`/api${href}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "리뷰 리포트를 불러오지 못했습니다.");
        }

        if (!cancelled) {
          setSnapshot(payload as ReviewReportsSnapshot);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.");
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [limit, mode, requestedReportId]);

  useEffect(() => {
    if (!snapshot || requestedReportId) {
      return;
    }

    const preferredReportId = getPreferredReportId(snapshot, requestedReportId);
    if (!preferredReportId) {
      return;
    }

    startTransition(() => {
      router.replace(buildReviewReportsHref({ mode, reportId: preferredReportId, limit }));
    });
  }, [limit, mode, requestedReportId, router, snapshot]);

  const selectedReport = snapshot?.selected_report.report ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Review Reports</p>
          <h1 className="mt-3 text-3xl font-semibold">Report Read Model</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Quick/Deep 리포트와 연결된 answer flow, summary cards, review queue를 한 화면에서 봅니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={buildReviewReportsHref({ limit })}
              className={`rounded-full px-4 py-2 text-sm ${
                mode === null ? "bg-white text-black" : "border border-white/20 text-zinc-200"
              }`}
            >
              all
            </Link>
            <Link
              href={buildReviewReportsHref({ mode: "quick", limit })}
              className={`rounded-full px-4 py-2 text-sm ${
                mode === "quick" ? "bg-white text-black" : "border border-white/20 text-zinc-200"
              }`}
            >
              quick
            </Link>
            <Link
              href={buildReviewReportsHref({ mode: "deep", limit })}
              className={`rounded-full px-4 py-2 text-sm ${
                mode === "deep" ? "bg-white text-black" : "border border-white/20 text-zinc-200"
              }`}
            >
              deep
            </Link>
            <Link href="/summary?version=today" className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200">
              오늘 요약집 보기
            </Link>
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            리포트 워크벤치를 읽는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {snapshot ? (
          <>
            {snapshot.reports.length === 0 ? (
              <section className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6">
                <h2 className="text-xl font-semibold">아직 review에 쌓인 리포트가 없습니다.</h2>
                <p className="mt-2 text-sm text-zinc-100">
                  solve에서 한 문제를 제출한 뒤 Quick Report를 저장하면 여기서 Answer Flow, Summary Card, Review Queue로 이어집니다.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Today Hub로 돌아가기
                  </Link>
                  <Link
                    href="/summary?version=today"
                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100"
                  >
                    오늘 요약집 보기
                  </Link>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Total Reports</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.inbox.counts.total_reports}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Pending Deep</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.inbox.counts.pending_deep}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Answer Flows</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.inbox.counts.answer_flows}</p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Reports</h2>
                  <p className="text-xs text-zinc-500">limit {snapshot.filters_applied.limit}</p>
                </div>
                <div className="space-y-3">
                  {snapshot.reports.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                      선택 가능한 리포트가 없습니다.
                    </p>
                  ) : (
                    snapshot.reports.map((report) => {
                      const isSelected = selectedReport?.id === report.id;

                      return (
                        <Link
                          key={report.id}
                          href={buildReviewReportsHref({
                            mode,
                            reportId: report.id,
                            limit,
                          })}
                          className={`block rounded-2xl border p-4 ${
                            isSelected
                              ? "border-cyan-300 bg-cyan-400/10"
                              : "border-white/10 bg-black/20 hover:border-white/30"
                          }`}
                        >
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{report.report_mode}</p>
                          <p className="mt-2 text-sm text-zinc-100">{report.my_frame}</p>
                          <p className="mt-2 text-xs text-zinc-400">{report.correct_mechanism}</p>
                        </Link>
                      );
                    })
                  )}
                </div>
              </aside>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                {!selectedReport ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-300">
                    {snapshot.reports.length > 0
                      ? "첫 리포트를 자동 선택하는 중입니다."
                      : "표시할 상세 리포트가 없습니다."}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        {selectedReport.report_mode}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">{selectedReport.my_frame}</h2>
                      <p className="mt-3 text-sm text-zinc-300">{selectedReport.correct_mechanism}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Next Tool</p>
                        <p className="mt-2 text-sm text-zinc-100">{selectedReport.next_tool}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Error Type</p>
                        <p className="mt-2 text-sm text-zinc-100">{selectedReport.error_type ?? "-"}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Answer Flow</p>
                        {snapshot.selected_report.answer_flow ? (
                          <div className="mt-3 space-y-2 text-sm text-zinc-200">
                            <p>질문: {snapshot.selected_report.answer_flow.ask}</p>
                            <p>핵심 인자: {snapshot.selected_report.answer_flow.key_factor}</p>
                            <p>메커니즘: {snapshot.selected_report.answer_flow.mechanism}</p>
                            <p>체크: {snapshot.selected_report.answer_flow.check}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-zinc-400">연결된 Answer Flow가 없습니다.</p>
                        )}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Review Queue</p>
                        {snapshot.selected_report.review_queue ? (
                          <div className="mt-3 space-y-2 text-sm text-zinc-200">
                            <p>다음 복습: {formatDateTimeLabel(snapshot.selected_report.review_queue.next_review_at)}</p>
                            <p>간격: {snapshot.selected_report.review_queue.interval_days}일</p>
                            <p>반복 수: {snapshot.selected_report.review_queue.repetitions}</p>
                            <p>우선순위: {snapshot.selected_report.review_queue.priority_score.toFixed(1)}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-zinc-400">리뷰 큐 정보가 없습니다.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Summary Cards</p>
                      <div className="mt-3 space-y-3">
                        {snapshot.selected_report.summary_cards.length === 0 ? (
                          <p className="text-sm text-zinc-400">요약 카드가 아직 없습니다.</p>
                        ) : (
                          snapshot.selected_report.summary_cards.map((card) => (
                            <div key={card.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{card.card_type}</p>
                              <p className="mt-2 text-sm text-zinc-100">{card.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function ReviewReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 text-zinc-300">
            review reports를 준비하는 중입니다.
          </main>
        </div>
      }
    >
      <ReviewReportsPageContent />
    </Suspense>
  );
}
