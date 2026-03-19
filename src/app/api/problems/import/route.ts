import { NextResponse } from "next/server";

import { importProblemResponseSchema, importProblemSchema } from "@/lib/contracts/problem-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import { parseSectionHybrid } from "@/lib/server/section-parser";

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = importProblemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid import payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const parser = await parseSectionHybrid({
    stem: parsed.data.stem,
    choices: parsed.data.choices,
  });

  const tags = Array.from(
    new Set([
      ...(parsed.data.tags ?? []),
      parsed.data.sub_type,
      ...(parser.needs_review ? ["needs_review"] : []),
    ]),
  );

  const problem = await repositories.problems.create({
    section: parsed.data.section,
    sub_type: parsed.data.sub_type,
    difficulty: parsed.data.difficulty,
    content: {
      stem: parsed.data.stem,
      choices: parsed.data.choices,
      answer_index: parsed.data.answer_index,
      explanation: parsed.data.explanation,
      image_ref: parsed.data.image_ref,
      import_meta: {
        parser,
      },
    },
    tags,
    source: "manual_capture",
    source_type: "manual",
    source_name: parsed.data.source_name,
    source_url: parsed.data.source_url,
    license_note: parsed.data.license_note,
    parser_confidence: parser.confidence,
    curation_status: "accepted",
    corpus_tier: "gold",
    last_curated_at: new Date().toISOString(),
  });

  return NextResponse.json(
    importProblemResponseSchema.parse({
      problem,
      parser,
      review_status: await repositories.problems.getReviewStatus(problem),
    }),
    { status: 201 },
  );
}
