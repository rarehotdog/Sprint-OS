import { NextResponse } from "next/server";

import {
  summaryBookletSchema,
  summaryQuerySchema,
} from "@/lib/contracts/summary-contracts";
import { ensureCanonicalStateLoaded } from "@/lib/server/persistence/repositories";
import { ensureSummaryBooklet } from "@/lib/server/summary-booklet-store";

export async function GET(request: Request) {
  await ensureCanonicalStateLoaded();
  const url = new URL(request.url);
  const parsed = summaryQuerySchema.safeParse({
    mode: url.searchParams.get("mode") ?? undefined,
    days: url.searchParams.get("days") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid summary query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const version = parsed.data.mode === "exam_day" ? "day" : "eve";
  const booklet = ensureSummaryBooklet(version);
  return NextResponse.json(summaryBookletSchema.parse(booklet), {
    headers: {
      "x-deprecated": "true",
    },
  });
}
