import { NextResponse } from "next/server";

import {
  summaryBuildRequestSchema,
  summaryBuildResponseSchema,
} from "@/lib/contracts/summary-contracts";
import { ensureCanonicalStateLoaded } from "@/lib/server/persistence/repositories";
import { buildSummaryBooklet } from "@/lib/server/summary-booklet-store";

export async function POST(request: Request) {
  await ensureCanonicalStateLoaded();
  const body = await request.json().catch(() => null);
  const parsed = summaryBuildRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid summary build payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const built = buildSummaryBooklet(parsed.data);
  return NextResponse.json(summaryBuildResponseSchema.parse(built));
}
