"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { normalizeSummaryVersion } from "@/lib/review-ui";
import type { SummaryBooklet } from "@/lib/types";

function SummaryPageContent() {
  const searchParams = useSearchParams();
  const version = normalizeSummaryVersion(searchParams.get("version"));

  const [booklet, setBooklet] = useState<SummaryBooklet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBooklet() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/summary/booklet?version=${version}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "요약집을 불러오지 못했습니다.");
        }

        if (!cancelled) {
          setBooklet(payload as SummaryBooklet);
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

    void loadBooklet();

    return () => {
      cancelled = true;
    };
  }, [version]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Summary Booklet</p>
          <h1 className="mt-3 text-3xl font-semibold">Version {version}</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Quick / Deep / Answer Flow / Weakness가 압축된 개인 요약집입니다.
          </p>
        </header>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            요약집을 빌드하는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {booklet ? (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Summary</p>
              <p className="mt-4 text-lg leading-8 text-zinc-100">{booklet.summary}</p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Concepts</h2>
                <div className="mt-4 space-y-3">
                  {booklet.sections.concepts.map((item, index) => (
                    <p key={`concept-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                      {item}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Process Flows</h2>
                <div className="mt-4 space-y-3">
                  {booklet.sections.process_flows.map((item, index) => (
                    <p key={`flow-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Tips</h2>
                <div className="mt-4 space-y-3">
                  {booklet.sections.tips.map((item, index) => (
                    <p key={`tip-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                      {item}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Checklist</h2>
                <div className="mt-4 space-y-3">
                  {booklet.sections.checklist.map((item, index) => (
                    <p
                      key={`check-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Diagnostics</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-zinc-400">Total Reports</p>
                  <p className="mt-2 text-2xl font-semibold">{booklet.diagnostics.source_counts.total_reports}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-zinc-400">Deep Reports</p>
                  <p className="mt-2 text-2xl font-semibold">{booklet.diagnostics.source_counts.deep_reports}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-zinc-400">Due Reviews</p>
                  <p className="mt-2 text-2xl font-semibold">{booklet.diagnostics.source_counts.due_reviews}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-zinc-400">Weak Subtypes</p>
                  <p className="mt-2 text-2xl font-semibold">{booklet.diagnostics.source_counts.weak_subtypes}</p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function SummaryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 text-zinc-300">
            summary booklet을 준비하는 중입니다.
          </main>
        </div>
      }
    >
      <SummaryPageContent />
    </Suspense>
  );
}
