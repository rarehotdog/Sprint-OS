"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { normalizeInboxActionHref } from "@/lib/review-ui";
import type { ReviewInboxSnapshot } from "@/lib/types";

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

export default function ReviewInboxPage() {
  const [snapshot, setSnapshot] = useState<ReviewInboxSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/review/inbox", { cache: "no-store" });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "리뷰 인박스를 불러오지 못했습니다.");
        }

        if (!cancelled) {
          setSnapshot(payload as ReviewInboxSnapshot);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInbox();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Review Inbox</p>
          <h1 className="mt-3 text-3xl font-semibold">Review Workbench</h1>
          <p className="mt-2 text-sm text-zinc-300">
            지금 바로 복기할 것, deep로 확장할 것, summary로 밀어 넣을 것을 한 번에 봅니다.
          </p>
        </header>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            리뷰 인박스를 읽는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {snapshot ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Total Reports</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.counts.total_reports}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Pending Deep</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.counts.pending_deep}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Due Self Test</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.counts.due_self_test}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Recent Deep</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.counts.recent_deep}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-zinc-400">Answer Flows</p>
                <p className="mt-2 text-3xl font-semibold">{snapshot.counts.answer_flows}</p>
              </div>
            </section>

            <section className="flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-white/5 p-6">
              {snapshot.next_actions.map((action) => (
                <Link
                  key={action.type}
                  href={normalizeInboxActionHref(action)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200"
                >
                  {action.label} ({action.count})
                </Link>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Pending Deep</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.pending_deep.length === 0 ? (
                    <p className="text-sm text-zinc-400">대기 중인 Quick 리포트가 없습니다.</p>
                  ) : (
                    snapshot.pending_deep.map((report) => (
                      <Link
                        key={report.id}
                        href={`/review/reports?mode=quick&report_id=${report.id}`}
                        className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/30"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{report.report_mode}</p>
                        <p className="mt-2 text-sm text-zinc-100">{report.my_frame}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Due Self Test</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.due_self_test.length === 0 ? (
                    <p className="text-sm text-zinc-400">지금 바로 볼 셀프 테스트가 없습니다.</p>
                  ) : (
                    snapshot.due_self_test.map((item) => (
                      <Link
                        key={item.review_queue_id}
                        href={`/review/reports?mode=deep&report_id=${item.report.id}`}
                        className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/30"
                      >
                        <p className="text-sm text-zinc-100">{item.report.correct_mechanism}</p>
                        <p className="mt-2 text-xs text-zinc-400">
                          복습 예정 {formatDateTimeLabel(item.next_review_at)} / priority {item.priority_score.toFixed(1)}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Recent Deep</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.recent_deep.length === 0 ? (
                    <p className="text-sm text-zinc-400">최근 Deep 리포트가 없습니다.</p>
                  ) : (
                    snapshot.recent_deep.map((report) => (
                      <Link
                        key={report.id}
                        href={`/review/reports?mode=deep&report_id=${report.id}`}
                        className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/30"
                      >
                        <p className="text-sm text-zinc-100">{report.correct_mechanism}</p>
                        <p className="mt-2 text-xs text-zinc-400">{report.next_tool}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Answer Flows</h2>
                <div className="mt-4 space-y-3">
                  {snapshot.answer_flows.length === 0 ? (
                    <p className="text-sm text-zinc-400">아직 생성된 Answer Flow가 없습니다.</p>
                  ) : (
                    snapshot.answer_flows.map((flow) => (
                      <div key={flow.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm font-medium text-zinc-100">{flow.ask}</p>
                        <p className="mt-2 text-sm text-zinc-300">{flow.mechanism}</p>
                        <p className="mt-2 text-xs text-zinc-400">check: {flow.check}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
