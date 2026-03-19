import { NextResponse } from "next/server";

import {
  generateAiProblemResponseSchema,
  generateAiProblemSchema,
} from "@/lib/contracts/problem-contracts";
import { generateProblemDrafts } from "@/lib/server/ai-problem-generator";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import { parseSectionHybrid } from "@/lib/server/section-parser";

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = generateAiProblemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid generate payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const generatedAt = new Date().toISOString();
  const { drafts, generationMode, context } = await generateProblemDrafts(parsed.data);
  const items = [];

  for (const draft of drafts) {
    const parser = await parseSectionHybrid({
      stem: draft.stem,
      choices: draft.choices,
    });

    const tags = Array.from(
      new Set([
        parser.sub_type,
        "ai_generated",
        ...(parser.needs_review ? ["needs_review"] : []),
      ]),
    );

    const problem = await repositories.problems.create({
      section: parser.section,
      sub_type: parser.sub_type,
      difficulty: parsed.data.difficulty,
      content: {
        stem: draft.stem,
        choices: draft.choices,
        answer_index: draft.answer_index,
        explanation: draft.explanation,
        generation_meta: {
          provider: context.provider,
          model: context.model,
          prompt_version: context.prompt_version,
          seed: context.seed,
          generated_at: generatedAt,
          parser,
        },
      },
      tags,
      source: "ai_generated",
      source_type: "generated",
      source_name: context.provider === "openai" ? "OpenAI" : "Mock Generator",
      parser_confidence: parser.confidence,
      curation_status: "needs_review",
      corpus_tier: "filler",
    });

    items.push({
      problem,
      parser,
      review_status: await repositories.problems.getReviewStatus(problem),
      generation_mode: generationMode,
      generation_meta: {
        provider: context.provider,
        model: context.model,
        prompt_version: context.prompt_version,
        seed: context.seed,
        generated_at: generatedAt,
        parser,
      },
    });
  }

  const strict = generateAiProblemResponseSchema.parse({
    items,
    total: items.length,
  });

  if (strict.items.length === 1) {
    const single = strict.items[0];
    return NextResponse.json({
      ...strict,
      problem: single?.problem,
      parser: single?.parser,
      review_status: single?.review_status,
      generation_mode: single?.generation_mode,
      generation_meta: single?.generation_meta,
    });
  }

  return NextResponse.json(strict);
}
