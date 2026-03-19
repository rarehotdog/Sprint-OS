"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { parseProblemSection, parseTagsInput } from "@/lib/problems-ui";
import type {
  Difficulty,
  Problem,
  ProblemCorpusTier,
  ProblemCurationStatus,
  Section,
} from "@/lib/types";

type ProblemReviewItem = {
  problem: Problem;
  parser: {
    section: Section;
    sub_type: string;
    confidence: number;
    parser_mode: "rule" | "ai_correction";
    needs_review: boolean;
  } | null;
  review_status: "accepted" | "needs_review";
  duplicate_count: number;
};

type ReviewListPayload = {
  items: ProblemReviewItem[];
  total: number;
  filters_applied: {
    curation_status: ProblemCurationStatus | null;
    corpus_tier: ProblemCorpusTier | null;
    import_batch_id: string | null;
    section: Section | null;
    limit: number;
  };
};

type FilterState = {
  curation_status: ProblemCurationStatus | "";
  corpus_tier: ProblemCorpusTier | "";
  section: Section | "";
  import_batch_id: string;
  limit: number;
};

type CardDraftState = {
  section: Section;
  sub_type: string;
  difficulty_estimate: Difficulty | "";
  source_name: string;
  source_url: string;
  license_note: string;
  corpus_tier: ProblemCorpusTier;
  tags: string;
  curated_by: string;
  note: string;
};

function createCardDraft(problem: Problem): CardDraftState {
  return {
    section: problem.section,
    sub_type: problem.sub_type,
    difficulty_estimate: problem.difficulty_estimate ?? "",
    source_name: problem.source_name ?? "",
    source_url: problem.source_url ?? "",
    license_note: problem.license_note ?? "",
    corpus_tier: problem.corpus_tier ?? "gold",
    tags: problem.tags.join(", "),
    curated_by: problem.curated_by ?? "",
    note: "",
  };
}

function createInitialFilters(searchParams: URLSearchParams): FilterState {
  const section = searchParams.get("section");
  const curationStatus = searchParams.get("curation_status");
  const corpusTier = searchParams.get("corpus_tier");
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);

  return {
    curation_status:
      curationStatus === "draft" ||
      curationStatus === "needs_review" ||
      curationStatus === "accepted" ||
      curationStatus === "rejected"
        ? curationStatus
        : "needs_review",
    corpus_tier:
      corpusTier === "gold" || corpusTier === "scale" || corpusTier === "filler"
        ? corpusTier
        : "",
    section: section ? parseProblemSection(section, "verbal") : "",
    import_batch_id: searchParams.get("import_batch_id") ?? "",
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 20), 200) : 50,
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

function buildReviewStatusQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));

  if (filters.curation_status) {
    params.set("curation_status", filters.curation_status);
  }
  if (filters.corpus_tier) {
    params.set("corpus_tier", filters.corpus_tier);
  }
  if (filters.section) {
    params.set("section", filters.section);
  }
  if (filters.import_batch_id.trim()) {
    params.set("import_batch_id", filters.import_batch_id.trim());
  }

  return params.toString();
}

async function fetchReviewItems(filters: FilterState): Promise<ReviewListPayload> {
  return readJson<ReviewListPayload>(
    `/api/problems/review-status?${buildReviewStatusQuery(filters)}`,
  );
}

function formatSectionLabel(section: Section): string {
  if (section === "verbal") return "Verbal";
  if (section === "quant") return "Quant";
  return "DI";
}

function formatCurationStatus(status: ProblemCurationStatus | null): string {
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "draft") return "draft";
  return "needs_review";
}

function ProblemInboxCard(props: {
  item: ProblemReviewItem;
  busy: boolean;
  onAction: (
    problemId: string,
    action: "accept" | "hold" | "revise" | "reject",
    draft: CardDraftState,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CardDraftState>(() => createCardDraft(props.item.problem));

  useEffect(() => {
    setDraft(createCardDraft(props.item.problem));
  }, [props.item.problem]);

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {formatSectionLabel(props.item.problem.section)} / {props.item.problem.sub_type}
          </p>
          <h3 className="mt-2 text-lg font-semibold">
            {String((props.item.problem.content.stem as string | undefined) ?? "Untitled problem")}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/15 px-3 py-1 text-zinc-300">
            {formatCurationStatus(props.item.problem.curation_status)}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-zinc-300">
            tier {props.item.problem.corpus_tier ?? "gold"}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-zinc-300">
            dupes {props.item.duplicate_count}
          </span>
        </div>
      </div>

      {props.item.duplicate_count > 1 ? (
        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-50">
          같은 canonical hash 후보가 {props.item.duplicate_count}개 있습니다. accept 전에 출처와 stem 중복을 확인하세요.
        </div>
      ) : null}

      <div className="mt-4 space-y-2 text-sm text-zinc-300">
        <p>source type {props.item.problem.source_type ?? "manual"} / source {props.item.problem.source_name ?? props.item.problem.source ?? "-"}</p>
        <p>parser confidence {props.item.parser ? props.item.parser.confidence.toFixed(2) : "-"}</p>
        <p>batch {props.item.problem.import_batch_id ?? "-"}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Section</span>
          <select
            value={draft.section}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                section: event.target.value === "quant" || event.target.value === "di" ? event.target.value : "verbal",
              }))
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="verbal">verbal</option>
            <option value="quant">quant</option>
            <option value="di">di</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Sub Type</span>
          <input
            value={draft.sub_type}
            onChange={(event) => setDraft((current) => ({ ...current, sub_type: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Difficulty Estimate</span>
          <select
            value={draft.difficulty_estimate}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                difficulty_estimate:
                  event.target.value === "easy" || event.target.value === "hard" || event.target.value === "medium"
                    ? event.target.value
                    : "",
              }))
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="">unset</option>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Corpus Tier</span>
          <select
            value={draft.corpus_tier}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                corpus_tier: event.target.value === "scale" || event.target.value === "filler" ? event.target.value : "gold",
              }))
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="gold">gold</option>
            <option value="scale">scale</option>
            <option value="filler">filler</option>
          </select>
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm text-zinc-300">Tags</span>
          <input
            value={draft.tags}
            onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Source Name</span>
          <input
            value={draft.source_name}
            onChange={(event) => setDraft((current) => ({ ...current, source_name: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Source URL</span>
          <input
            value={draft.source_url}
            onChange={(event) => setDraft((current) => ({ ...current, source_url: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm text-zinc-300">License Note</span>
          <input
            value={draft.license_note}
            onChange={(event) => setDraft((current) => ({ ...current, license_note: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Curated By</span>
          <input
            value={draft.curated_by}
            onChange={(event) => setDraft((current) => ({ ...current, curated_by: event.target.value }))}
            placeholder="tyler / codex"
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-300">Note</span>
          <input
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            placeholder="hold / reject 사유"
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void props.onAction(props.item.problem.id, "revise", draft)}
          disabled={props.busy}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          revise 저장
        </button>
        <button
          type="button"
          onClick={() => void props.onAction(props.item.problem.id, "accept", draft)}
          disabled={props.busy}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          accept
        </button>
        <button
          type="button"
          onClick={() => void props.onAction(props.item.problem.id, "hold", draft)}
          disabled={props.busy}
          className="rounded-full border border-amber-300/30 px-4 py-2 text-sm text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          hold
        </button>
        <button
          type="button"
          onClick={() => void props.onAction(props.item.problem.id, "reject", draft)}
          disabled={props.busy}
          className="rounded-full border border-rose-400/30 px-4 py-2 text-sm text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          reject
        </button>
      </div>
    </article>
  );
}

function ProblemsInboxContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => createInitialFilters(searchParams));
  const [items, setItems] = useState<ProblemReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProblemId, setBusyProblemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadInbox(nextFilters: FilterState, showSpinner = false) {
    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      const payload = await fetchReviewItems(nextFilters);
      setItems(payload.items);
      setTotal(payload.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "curation inbox를 불러오지 못했습니다.");
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const initialFilters = createInitialFilters(searchParams);
    setFilters(initialFilters);
    let cancelled = false;

    setIsLoading(true);
    void fetchReviewItems(initialFilters)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setItems(payload.items);
        setTotal(payload.total);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "curation inbox를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleAction(
    problemId: string,
    action: "accept" | "hold" | "revise" | "reject",
    draft: CardDraftState,
  ) {
    setBusyProblemId(problemId);
    setError(null);
    setSuccess(null);

    try {
      await readJson("/api/problems/review-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem_id: problemId,
          action,
          section: draft.section,
          sub_type: draft.sub_type,
          difficulty_estimate: draft.difficulty_estimate || undefined,
          source_name: draft.source_name.trim() || undefined,
          source_url: draft.source_url.trim() || undefined,
          license_note: draft.license_note.trim() || undefined,
          corpus_tier: draft.corpus_tier,
          tags: parseTagsInput(draft.tags),
          curated_by: draft.curated_by.trim() || undefined,
          note: draft.note.trim() || undefined,
        }),
      });

      await loadInbox(filters, false);
      setSuccess(`${problemId.slice(0, 8)} 문제를 ${action} 처리했습니다.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "문제 상태를 저장하지 못했습니다.");
    } finally {
      setBusyProblemId(null);
    }
  }

  function updateFilters(next: Partial<FilterState>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    void loadInbox(merged, false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Problems Inbox</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Curation Workbench</h1>
              <p className="mt-3 max-w-3xl text-sm text-zinc-300">
                imported problem provenance를 확인하고 accepted gold/scale만 메인 solve와 booklet에 올립니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/problems" className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100">
                problems workbench
              </Link>
              <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100">
                Today Hub
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {success ? (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-zinc-100">
            {success}
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Curation Status</span>
              <select
                value={filters.curation_status}
                onChange={(event) =>
                  updateFilters({
                    curation_status:
                      event.target.value === "draft" ||
                      event.target.value === "accepted" ||
                      event.target.value === "rejected" ||
                      event.target.value === "needs_review"
                        ? event.target.value
                        : "",
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
              >
                <option value="">all</option>
                <option value="needs_review">needs_review</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
                <option value="draft">draft</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Corpus Tier</span>
              <select
                value={filters.corpus_tier}
                onChange={(event) =>
                  updateFilters({
                    corpus_tier:
                      event.target.value === "gold" ||
                      event.target.value === "scale" ||
                      event.target.value === "filler"
                        ? event.target.value
                        : "",
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
              >
                <option value="">all</option>
                <option value="gold">gold</option>
                <option value="scale">scale</option>
                <option value="filler">filler</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Section</span>
              <select
                value={filters.section}
                onChange={(event) =>
                  updateFilters({
                    section:
                      event.target.value === "verbal" ||
                      event.target.value === "quant" ||
                      event.target.value === "di"
                        ? event.target.value
                        : "",
                  })
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
              >
                <option value="">all</option>
                <option value="verbal">verbal</option>
                <option value="quant">quant</option>
                <option value="di">di</option>
              </select>
            </label>

            <label className="min-w-72 grid gap-2">
              <span className="text-sm text-zinc-300">Import Batch ID</span>
              <input
                value={filters.import_batch_id}
                onChange={(event) => setFilters((current) => ({ ...current, import_batch_id: event.target.value }))}
                onBlur={() => updateFilters({ import_batch_id: filters.import_batch_id })}
                placeholder="uuid"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
              total {total}
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            curation inbox를 읽는 중입니다.
          </section>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
            현재 필터에 맞는 문제가 없습니다. bulk import를 실행하거나 필터를 넓혀 보세요.
          </section>
        ) : null}

        <section className="grid gap-5">
          {items.map((item) => (
            <ProblemInboxCard
              key={item.problem.id}
              item={item}
              busy={busyProblemId === item.problem.id}
              onAction={handleAction}
            />
          ))}
        </section>
      </main>
    </div>
  );
}

export default function ProblemsInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 text-zinc-300">
            problems inbox를 준비하는 중입니다.
          </main>
        </div>
      }
    >
      <ProblemsInboxContent />
    </Suspense>
  );
}
