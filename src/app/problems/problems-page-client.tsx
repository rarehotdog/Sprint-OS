"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  buildStarterGeneratePayload,
  countProblemsBySection,
  createEmptyProblemInventory,
  getDefaultImportSubType,
  parseChoicesInput,
  parseProblemSection,
  parseTagsInput,
} from "@/lib/problems-ui";
import type { Problem, ProblemImportInputType, Section } from "@/lib/types";

type ImportFormState = {
  sub_type: string;
  stem: string;
  choices: string;
  answer_index: string;
  explanation: string;
  tags: string;
};

type BulkImportFormState = {
  input_type: ProblemImportInputType;
  raw_payload: string;
  source_name: string;
  source_url: string;
  license_note: string;
  notes: string;
};

function createDefaultImportForm(section: Section): ImportFormState {
  return {
    sub_type: getDefaultImportSubType(section),
    stem: "",
    choices: "",
    answer_index: "",
    explanation: "",
    tags: "",
  };
}

function createDefaultBulkImportForm(): BulkImportFormState {
  return {
    input_type: "text",
    raw_payload: "",
    source_name: "",
    source_url: "",
    license_note: "",
    notes: "",
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

async function fetchProblems(solveReady = false): Promise<Problem[]> {
  const search = new URLSearchParams();
  if (solveReady) {
    search.set("solve_ready", "true");
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  const payload = await readJson<{ problems: Problem[] }>(`/api/problems${suffix}`);
  return payload.problems;
}

export default function ProblemsPageClient() {
  const searchParams = useSearchParams();
  const requestedSection = parseProblemSection(searchParams.get("section"));

  const [selectedSection, setSelectedSection] = useState<Section>(requestedSection);
  const [inventory, setInventory] = useState(createEmptyProblemInventory());
  const [solveReadyInventory, setSolveReadyInventory] = useState(createEmptyProblemInventory());
  const [importForm, setImportForm] = useState<ImportFormState>(
    createDefaultImportForm(requestedSection),
  );
  const [bulkImportForm, setBulkImportForm] = useState<BulkImportFormState>(
    createDefaultBulkImportForm(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  async function refreshInventory(showSpinner = false) {
    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      const [allProblems, solveReadyProblems] = await Promise.all([
        fetchProblems(false),
        fetchProblems(true),
      ]);
      setInventory(countProblemsBySection(allProblems));
      setSolveReadyInventory(countProblemsBySection(solveReadyProblems));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "문제 재고를 불러오지 못했습니다.");
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshInventory(true);
  }, []);

  useEffect(() => {
    setSelectedSection(requestedSection);
    setImportForm(createDefaultImportForm(requestedSection));
  }, [requestedSection]);

  async function handleGenerateStarterSet() {
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setLastBatchId(null);

    try {
      const payload = buildStarterGeneratePayload(selectedSection);
      const result = await readJson<{ total: number }>("/api/problems/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      await refreshInventory(false);
      setSuccess(`${selectedSection} starter 세트 ${result.total}문항을 준비했습니다.`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "starter 세트를 만들지 못했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleImportProblem() {
    setIsImporting(true);
    setError(null);
    setSuccess(null);
    setLastBatchId(null);

    try {
      const answerIndex =
        importForm.answer_index.trim().length > 0
          ? Number.parseInt(importForm.answer_index, 10)
          : undefined;

      await readJson("/api/problems/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: selectedSection,
          sub_type: importForm.sub_type,
          stem: importForm.stem,
          choices: parseChoicesInput(importForm.choices),
          answer_index: Number.isFinite(answerIndex) ? answerIndex : undefined,
          explanation: importForm.explanation.trim() || undefined,
          tags: parseTagsInput(importForm.tags),
        }),
      });

      await refreshInventory(false);
      setSuccess("문제를 추가했습니다. Today Hub로 돌아가 스프린트를 이어갈 수 있습니다.");
      setImportForm(createDefaultImportForm(selectedSection));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "문제 import에 실패했습니다.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleBatchImport() {
    setIsBatchImporting(true);
    setError(null);
    setSuccess(null);
    setLastBatchId(null);

    try {
      const result = await readJson<{
        batch: { id: string };
        created_rows: number;
        invalid_rows: number;
        duplicate_rows: number;
      }>("/api/problems/import/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input_type: bulkImportForm.input_type,
          raw_payload: bulkImportForm.raw_payload,
          source_name: bulkImportForm.source_name.trim() || null,
          source_url: bulkImportForm.source_url.trim() || null,
          license_note: bulkImportForm.license_note.trim() || null,
          notes: bulkImportForm.notes.trim() || null,
        }),
      });

      await refreshInventory(false);
      setLastBatchId(result.batch.id);
      setSuccess(
        `batch import 완료: ${result.created_rows}문항 생성, invalid ${result.invalid_rows}, duplicate warning ${result.duplicate_rows}.`,
      );
      setBulkImportForm(createDefaultBulkImportForm());
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "bulk import에 실패했습니다.");
    } finally {
      setIsBatchImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Problems Workbench</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Starter Problem Prep</h1>
          <p className="mt-3 max-w-3xl text-sm text-zinc-300">
            solve 진입 전에 필요한 starter 세트를 빠르게 만들거나 수동으로 문제를 추가합니다.
          </p>
        </header>

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            문제 재고를 읽는 중입니다.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {success ? (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6">
            <p className="text-sm text-zinc-100">{success}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Today Hub로 돌아가기
              </Link>
              {lastBatchId ? (
                <Link
                  href={`/problems/inbox?import_batch_id=${lastBatchId}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-100"
                >
                  이 batch 검수하기
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Verbal</p>
            <p className="mt-2 text-3xl font-semibold">{inventory.verbal}</p>
            <p className="mt-1 text-xs text-zinc-500">solve-ready {solveReadyInventory.verbal}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Quant</p>
            <p className="mt-2 text-3xl font-semibold">{inventory.quant}</p>
            <p className="mt-1 text-xs text-zinc-500">solve-ready {solveReadyInventory.quant}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">DI</p>
            <p className="mt-2 text-3xl font-semibold">{inventory.di}</p>
            <p className="mt-1 text-xs text-zinc-500">solve-ready {solveReadyInventory.di}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Total</p>
            <p className="mt-2 text-3xl font-semibold">{inventory.total}</p>
            <p className="mt-1 text-xs text-zinc-500">solve-ready {solveReadyInventory.total}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Curation Inbox</p>
              <h2 className="mt-2 text-2xl font-semibold">검수 대기 문제 확인</h2>
              <p className="mt-2 text-sm text-zinc-300">
                bulk import 문제는 `needs_review`로 들어갑니다. accepted로 올려야 메인 solve와 booklet이 신뢰합니다.
              </p>
            </div>
            <Link
              href="/problems/inbox"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-zinc-200"
            >
              inbox 열기
            </Link>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Starter Generate</p>
                <h2 className="mt-2 text-2xl font-semibold">빠른 starter 세트 만들기</h2>
              </div>
              <select
                value={selectedSection}
                onChange={(event) => {
                  const nextSection = parseProblemSection(event.target.value);
                  setSelectedSection(nextSection);
                  setImportForm(createDefaultImportForm(nextSection));
                }}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
              >
                <option value="verbal">verbal</option>
                <option value="quant">quant</option>
                <option value="di">di</option>
              </select>
            </div>

            <p className="mt-4 text-sm text-zinc-300">
              현재 선택 섹션에 대해 mock/openai generate API를 그대로 사용해 3문항 starter 세트를 만듭니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleGenerateStarterSet()}
                disabled={isGenerating}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? "생성 중..." : `${selectedSection} starter 3문항 생성`}
              </button>
              <Link
                href="/"
                className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-zinc-200"
              >
                Today Hub
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Manual Import</p>
            <h2 className="mt-2 text-2xl font-semibold">수동으로 문제 추가</h2>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Sub Type</span>
                <input
                  value={importForm.sub_type}
                  onChange={(event) =>
                    setImportForm((current) => ({ ...current, sub_type: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Stem</span>
                <textarea
                  value={importForm.stem}
                  onChange={(event) =>
                    setImportForm((current) => ({ ...current, stem: event.target.value }))
                  }
                  rows={4}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Choices</span>
                <textarea
                  value={importForm.choices}
                  onChange={(event) =>
                    setImportForm((current) => ({ ...current, choices: event.target.value }))
                  }
                  rows={5}
                  placeholder={"한 줄에 하나씩 입력\nChoice A\nChoice B"}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Answer Index</span>
                  <input
                    type="number"
                    min={0}
                    value={importForm.answer_index}
                    onChange={(event) =>
                      setImportForm((current) => ({ ...current, answer_index: event.target.value }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Tags</span>
                  <input
                    value={importForm.tags}
                    onChange={(event) =>
                      setImportForm((current) => ({ ...current, tags: event.target.value }))
                    }
                    placeholder="comma,separated,tags"
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Explanation</span>
                <textarea
                  value={importForm.explanation}
                  onChange={(event) =>
                    setImportForm((current) => ({ ...current, explanation: event.target.value }))
                  }
                  rows={3}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleImportProblem()}
                disabled={isImporting}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? "추가 중..." : "문제 추가"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Bulk Manual Import</p>
            <h2 className="mt-2 text-2xl font-semibold">text / csv batch 넣기</h2>
            <p className="mt-4 text-sm text-zinc-300">
              여러 문제를 한 번에 넣고, curation inbox에서 accept / hold / reject로 정리합니다.
            </p>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Input Type</span>
                <select
                  value={bulkImportForm.input_type}
                  onChange={(event) =>
                    setBulkImportForm((current) => ({
                      ...current,
                      input_type: event.target.value === "csv" ? "csv" : "text",
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                >
                  <option value="text">text blocks</option>
                  <option value="csv">csv</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Source Name</span>
                  <input
                    value={bulkImportForm.source_name}
                    onChange={(event) =>
                      setBulkImportForm((current) => ({ ...current, source_name: event.target.value }))
                    }
                    placeholder="GMAT notes / official set / personal bank"
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Source URL</span>
                  <input
                    value={bulkImportForm.source_url}
                    onChange={(event) =>
                      setBulkImportForm((current) => ({ ...current, source_url: event.target.value }))
                    }
                    placeholder="https://..."
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">License / Notes</span>
                <input
                  value={bulkImportForm.license_note}
                  onChange={(event) =>
                    setBulkImportForm((current) => ({ ...current, license_note: event.target.value }))
                  }
                  placeholder="private notes / classroom use / source restrictions"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Batch Notes</span>
                <input
                  value={bulkImportForm.notes}
                  onChange={(event) =>
                    setBulkImportForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="예: CR 오답노트 12문항"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Raw Payload</span>
                <textarea
                  value={bulkImportForm.raw_payload}
                  onChange={(event) =>
                    setBulkImportForm((current) => ({ ...current, raw_payload: event.target.value }))
                  }
                  rows={14}
                  placeholder={
                    bulkImportForm.input_type === "csv"
                      ? "section,sub_type,stem,choice_a,choice_b,choice_c,choice_d,choice_e,answer,explanation,tags"
                      : "Section: verbal\nSubtype: cr_assumption\nStem: ...\nA: ...\nB: ...\nC: ...\nD: ...\nE: ...\nAnswer: 2"
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleBatchImport()}
                disabled={isBatchImporting}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBatchImporting ? "import 중..." : "batch import 실행"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
