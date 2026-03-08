import { NextResponse } from "next/server";

import { importProblemResponseSchema, importProblemSchema } from "@/lib/contracts/problem-contracts";
import { createProblem, getProblemReviewStatus } from "@/lib/server/problems-store";
import { parseSectionHybrid } from "@/lib/server/section-parser";

export async function POST(request: Request) {
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

  const problem = createProblem({
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
  });

  return NextResponse.json(
    importProblemResponseSchema.parse({
      problem,
      parser,
      review_status: getProblemReviewStatus(problem),
    }),
    { status: 201 },
  );
}
