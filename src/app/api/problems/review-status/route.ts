import { NextResponse } from "next/server";

import {
  problemReviewStatusListResponseSchema,
  problemReviewStatusQuerySchema,
  problemReviewStatusResponseSchema,
  updateProblemReviewStatusSchema,
} from "@/lib/contracts/problem-contracts";
import {
  getProblemReviewItem,
  listProblemReviewItems,
  updateProblemReviewStatus,
} from "@/lib/server/problems-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = problemReviewStatusQuerySchema.safeParse({
    problem_id: url.searchParams.get("problem_id") ?? undefined,
    review_status: url.searchParams.get("review_status") ?? undefined,
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
    const item = getProblemReviewItem(parsed.data.problem_id);
    if (!item) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    return NextResponse.json(problemReviewStatusResponseSchema.parse(item));
  }

  const listed = listProblemReviewItems({
    review_status: parsed.data.review_status,
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
        section: parsed.data.section ?? null,
        source: parsed.data.source ?? null,
        tag: parsed.data.tag ?? null,
        limit: parsed.data.limit,
      },
    }),
  );
}

export async function POST(request: Request) {
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
    const updated = updateProblemReviewStatus(parsed.data);
    return NextResponse.json(problemReviewStatusResponseSchema.parse(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Problem not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
