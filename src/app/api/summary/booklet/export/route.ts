import { NextResponse } from "next/server";

import {
  summaryExportQuerySchema,
  summaryExportResponseSchema,
} from "@/lib/contracts/summary-contracts";
import { exportSummaryBookletMarkdown } from "@/lib/server/summary-booklet-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = summaryExportQuerySchema.safeParse({
    version: url.searchParams.get("version") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid summary export query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const exported = exportSummaryBookletMarkdown(parsed.data.version);
  return NextResponse.json(summaryExportResponseSchema.parse(exported));
}
