import { NextResponse } from "next/server";

import {
  bulkImportProblemsResponseSchema,
  bulkImportProblemsSchema,
} from "@/lib/contracts/problem-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import { parseCsvProblemBatch, parseTextProblemBatch } from "@/lib/server/problem-batch-import";
import { computeProblemCanonicalHash } from "@/lib/server/problems-store";
import { parseSectionHybrid } from "@/lib/server/section-parser";

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = bulkImportProblemsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid problem import batch payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const parsedBatch =
    parsed.data.input_type === "csv"
      ? parseCsvProblemBatch(parsed.data.raw_payload)
      : parseTextProblemBatch(parsed.data.raw_payload);

  const existingProblems = await repositories.problems.list();
  const existingCounts = new Map<string, number>();
  for (const problem of existingProblems) {
    const hash = problem.canonical_hash;
    if (!hash) continue;
    existingCounts.set(hash, (existingCounts.get(hash) ?? 0) + 1);
  }

  const batchCounts = new Map<string, number>();
  for (const draft of parsedBatch.drafts) {
    const hash = computeProblemCanonicalHash({
      stem: draft.stem,
      choices: draft.choices,
    });
    if (!hash) continue;
    batchCounts.set(hash, (batchCounts.get(hash) ?? 0) + 1);
  }

  const duplicateRows = parsedBatch.drafts.filter((draft) => {
    const hash = computeProblemCanonicalHash({
      stem: draft.stem,
      choices: draft.choices,
    });
    if (!hash) {
      return false;
    }

    return (existingCounts.get(hash) ?? 0) + (batchCounts.get(hash) ?? 0) > 1;
  }).length;

  const batch = await repositories.problems.createImportBatch({
    input_type: parsed.data.input_type,
    source_name: parsed.data.source_name ?? null,
    source_url: parsed.data.source_url ?? null,
    license_note: parsed.data.license_note ?? null,
    notes: parsed.data.notes ?? null,
    total_rows: parsedBatch.drafts.length + parsedBatch.errors.length,
    created_rows: parsedBatch.drafts.length,
    invalid_rows: parsedBatch.errors.length,
    duplicate_rows: duplicateRows,
  });

  const items = [];
  for (const draft of parsedBatch.drafts) {
    const parser = await parseSectionHybrid({
      stem: draft.stem,
      choices: draft.choices,
    });
    const canonicalHash = computeProblemCanonicalHash({
      stem: draft.stem,
      choices: draft.choices,
    });
    const duplicateCount = canonicalHash
      ? (existingCounts.get(canonicalHash) ?? 0) + (batchCounts.get(canonicalHash) ?? 0)
      : 0;

    const problem = await repositories.problems.create({
      section: draft.section,
      sub_type: draft.sub_type,
      difficulty: draft.difficulty,
      content: {
        stem: draft.stem,
        choices: draft.choices,
        answer_index: draft.answer_index,
        explanation: draft.explanation,
        import_meta: {
          parser,
        },
      },
      tags: Array.from(
        new Set([
          ...draft.tags,
          draft.sub_type,
          ...(parser.needs_review ? ["needs_review"] : []),
          ...(duplicateCount > 1 ? ["duplicate_candidate"] : []),
        ]),
      ),
      source: "manual_capture",
      source_type: "manual",
      source_name: parsed.data.source_name ?? undefined,
      source_url: parsed.data.source_url ?? undefined,
      license_note: parsed.data.license_note ?? undefined,
      parser_confidence: parser.confidence,
      curation_status: "needs_review",
      corpus_tier: "gold",
      canonical_hash: canonicalHash ?? undefined,
      import_batch_id: batch.id,
    });

    items.push({
      row_number: draft.row_number,
      problem,
      parser,
      review_status: await repositories.problems.getReviewStatus(problem),
      duplicate_count: duplicateCount,
    });
  }

  return NextResponse.json(
    bulkImportProblemsResponseSchema.parse({
      batch,
      items,
      total_rows: batch.total_rows,
      created_rows: batch.created_rows,
      invalid_rows: batch.invalid_rows,
      duplicate_rows: batch.duplicate_rows,
      errors: parsedBatch.errors,
    }),
    { status: 201 },
  );
}
