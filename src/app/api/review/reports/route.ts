import { NextResponse } from "next/server";

import {
  reviewReportsQuerySchema,
  reviewReportsResponseSchema,
} from "@/lib/contracts/review-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET(request: Request) {
  const repositories = getServerRepositories();
  const url = new URL(request.url);
  const parsed = reviewReportsQuerySchema.safeParse({
    report_id: url.searchParams.get("report_id") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid review reports query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    reviewReportsResponseSchema.parse(repositories.review.getReportsView(parsed.data)),
  );
}

