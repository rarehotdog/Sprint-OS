import { NextResponse } from "next/server";

import {
  problemReviewStatusListResponseSchema,
  problemReviewStatusQuerySchema,
  problemReviewStatusResponseSchema,
  updateProblemReviewStatusSchema,
} from "@/lib/contracts/problem-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET(request: Request) {
  const repositories = await getServerRepositories();
  const url = new URL(request.url);
  const parsed = problemReviewStatusQuerySchema.safeParse({
    problem_id: url.searchParams.get("problem_id") ?? undefined,
    review_status: url.searchParams.get("review_status") ?? undefined,
    curation_status: url.searchParams.get("curation_status") ?? undefined,
    corpus_tier: url.searchParams.get("corpus_tier") ?? undefined,
    import_batch_id: url.searchParams.get("import_batch_id") ?? undefined,
    section: url.searchParams.get("section") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid review status query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (parsed.data.problem_id) {
    const item = await repositories.problems.getReviewItem(parsed.data.problem_id);
    if (!item) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    return NextResponse.json(problemReviewStatusResponseSchema.parse(item));
  }

  const listed = await repositories.problems.listReviewItems({
    review_status: parsed.data.review_status,
    curation_status: parsed.data.curation_status,
    corpus_tier: parsed.data.corpus_tier,
    import_batch_id: parsed.data.import_batch_id,
    section: parsed.data.section,
    source: parsed.data.source,
    tag: parsed.data.tag,
    limit: parsed.data.limit,
  });

  return NextResponse.json(
    problemReviewStatusListResponseSchema.parse({
      items: listed.items,
      total: listed.total,
      filters_applied: {
        review_status: parsed.data.review_status ?? null,
        curation_status: parsed.data.curation_status ?? null,
        corpus_tier: parsed.data.corpus_tier ?? null,
        import_batch_id: parsed.data.import_batch_id ?? null,
        section: parsed.data.section ?? null,
        source: parsed.data.source ?? null,
        tag: parsed.data.tag ?? null,
        limit: parsed.data.limit,
      },
    }),
  );
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = updateProblemReviewStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid review status payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const updated = await repositories.problems.updateReviewStatus(parsed.data);
    return NextResponse.json(problemReviewStatusResponseSchema.parse(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Problem not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
