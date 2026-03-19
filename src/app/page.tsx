"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { buildProblemsWorkbenchHref } from "@/lib/problems-ui";
import {
  getTodayQueueFocusLine,
  getTodayQueueItems,
  getTodayQueuePrimaryAction,
  getTodayStartCheckin,
} from "@/lib/today-ui";
import type { Section, TodayQueueItem, TodaySnapshot, TodayStartResponse } from "@/lib/types";

function getClientDateYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatSectionLabel(section: Section): string {
  if (section === "verbal") return "Verbal";
  if (section === "quant") return "Quant";
  return "Data Insights";
}

function formatDueLabel(value: string | null): string {
  if (!value) {
    return "New today";
  }

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

function formatQueueSource(item: TodayQueueItem): string {
  return item.source === "due_review" ? "Due review" : "New set";
}

function formatQueueStatus(item: TodayQueueItem): string {
  if (item.status === "current") {
    return "Start here";
  }

  if (item.status === "completed") {
    return "Done";
  }

  return "Up next";
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

function getRecommendedProblemsHref(snapshot: TodaySnapshot | null): string {
  const queueSection =
    snapshot?.today_queue.find((item) => item.status !== "completed")?.section ??
    snapshot?.plan?.blocks.find((block) => block.block_type === "main_block")?.section_hint ??
    snapshot?.yesterday_weakness?.[0]?.section ??
    null;

  return buildProblemsWorkbenchHref(queueSection);
}

export default function Home() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSnapshot(showSpinner = false) {
    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      const nextSnapshot = await readJson<TodaySnapshot>("/api/today");
      setSnapshot(nextSnapshot);
      setError(null);
      return nextSnapshot;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Today Queue를 불러오지 못했습니다.");
      return null;
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadSnapshot(true);
  }, []);

  const queueItems = getTodayQueueItems(snapshot);
  const problemsHref = getRecommendedProblemsHref(snapshot);
  const primaryAction = getTodayQueuePrimaryAction({
    resumeSessionId: snapshot?.resume_session_id ?? null,
    focusProblemId: snapshot?.focus_problem_id ?? null,
    queueCounts: snapshot?.queue_counts ?? null,
    problemsHref,
  });
  const focusLine = getTodayQueueFocusLine(snapshot?.queue_counts ?? null);
  const queueCounts = snapshot?.queue_counts ?? null;
  const shortage =
    Boolean(queueCounts?.shortage) &&
    (queueCounts?.new_problems ?? 0) < (queueCounts?.target_new_problems ?? 0);
  const currentItem = queueItems.find((item) => item.status === "current") ?? null;

  async function handlePrimaryAction() {
    setError(null);

    if (primaryAction.kind === "prepare" && primaryAction.href) {
      startTransition(() => {
        router.push(primaryAction.href as string);
      });
      return;
    }

    if ((primaryAction.kind === "resume" || primaryAction.kind === "completed") && primaryAction.href) {
      startTransition(() => {
        router.push(primaryAction.href as string);
      });
      return;
    }

    setIsStarting(true);

    try {
      const started = await readJson<TodayStartResponse>("/api/today/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: snapshot?.checkin?.date ?? getClientDateYmd(),
          checkin: getTodayStartCheckin(snapshot?.checkin ?? null),
        }),
      });

      startTransition(() => {
        router.push(started.redirect_to);
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "오늘 리스트를 시작하지 못했습니다.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-12 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-100">
                Today Queue
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                오늘 바로 풀 리스트
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-200">{focusLine}</p>
            </div>

            <div className="grid gap-2 text-sm text-zinc-300 sm:text-right">
              <span className="text-zinc-500">date</span>
              <span>{snapshot?.checkin?.date ?? getClientDateYmd()}</span>
            </div>
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 text-zinc-300 backdrop-blur">
            오늘 큐를 불러오는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[1.75rem] border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Ordered Queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">오늘 순서대로 풀 것</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                {queueCounts?.total ?? 0} items
              </span>
            </div>

            {queueItems.length === 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-6 text-sm text-zinc-300">
                아직 오늘 큐가 비어 있습니다. curated 문제를 준비하면 같은 solve runner에서 바로 이어서 풀 수 있습니다.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {queueItems.map((item, index) => {
                  const isCurrent = item.status === "current";
                  const isCompleted = item.status === "completed";

                  return (
                    <article
                      key={`${item.problem_id}-${item.source}`}
                      className={`rounded-[1.5rem] border px-5 py-5 transition ${
                        isCurrent
                          ? "border-emerald-300/40 bg-emerald-300/10 shadow-[0_14px_40px_rgba(16,185,129,0.12)]"
                          : isCompleted
                            ? "border-white/8 bg-black/10 opacity-70"
                            : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-4">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                              isCurrent
                                ? "bg-white text-black"
                                : isCompleted
                                  ? "bg-white/10 text-zinc-300"
                                  : "bg-zinc-900 text-zinc-200"
                            }`}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                                {formatQueueStatus(item)}
                              </span>
                              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                {formatQueueSource(item)}
                              </span>
                            </div>
                            <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                            <p className="mt-2 text-sm text-zinc-300">
                              {formatSectionLabel(item.section)} · {item.sub_type}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-1 text-sm text-zinc-400 sm:text-right">
                          <span>{item.source === "due_review" ? "복습 due" : "새 문제"}</span>
                          <span>{formatDueLabel(item.due_at)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Start</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">{primaryAction.label}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{primaryAction.description}</p>

              <button
                type="button"
                onClick={() => void handlePrimaryAction()}
                disabled={isLoading || isStarting}
                className="mt-6 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStarting ? "준비 중..." : primaryAction.label}
              </button>

              {currentItem ? (
                <div className="mt-6 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/8 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/80">Current Focus</p>
                  <p className="mt-2 text-base font-semibold text-white">{currentItem.title}</p>
                  <p className="mt-2 text-sm text-zinc-200">
                    {formatSectionLabel(currentItem.section)} · {formatQueueSource(currentItem)}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Today Numbers</p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Due Today</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{queueCounts?.due_review ?? 0}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">New Today</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{queueCounts?.new_problems ?? 0}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Estimated Time</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{queueCounts?.estimated_minutes ?? 0}m</p>
                </div>
              </div>
            </section>

            {shortage ? (
              <section className="rounded-[2rem] border border-amber-300/30 bg-amber-400/10 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">Queue Shortage</p>
                <h2 className="mt-2 text-xl font-semibold text-white">curated 문제를 먼저 보충해야 합니다.</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-100">
                  목표는 새 문제 {queueCounts?.target_new_problems ?? 0}개인데, 현재 자동 큐에 올라온 문제는{" "}
                  {queueCounts?.new_problems ?? 0}개입니다. filler를 자동으로 넣지 않고, curated 공급을 먼저 맞춥니다.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={problemsHref}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    문제 보충하기
                  </Link>
                  <Link
                    href="/problems/inbox"
                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100"
                  >
                    큐레이션 inbox
                  </Link>
                </div>
              </section>
            ) : null}
          </aside>
        </section>

        <section className="flex flex-wrap gap-3 text-sm text-zinc-300">
          <Link href="/review/reports" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 hover:border-white/30">
            Report History
          </Link>
          <Link href="/summary?version=today" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 hover:border-white/30">
            Today Booklet
          </Link>
          <Link href="/problems" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 hover:border-white/30">
            Problems Workbench
          </Link>
        </section>
      </main>
    </div>
  );
}
