import { NextResponse } from "next/server";

import {
  summaryBookletQuerySchema,
  summaryBookletSchema,
} from "@/lib/contracts/summary-contracts";
import { ensureSummaryBooklet } from "@/lib/server/summary-booklet-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = summaryBookletQuerySchema.safeParse({
    version: url.searchParams.get("version") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid summary booklet query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const booklet = ensureSummaryBooklet(parsed.data.version);
  return NextResponse.json(summaryBookletSchema.parse(booklet));
}
