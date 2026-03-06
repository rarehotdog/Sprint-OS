import { NextResponse } from "next/server";

import {
  analyzeReportRequestSchema,
  analyzeReportResponseSchema,
} from "@/lib/contracts/report-contracts";
import { analyzeReportWithClaude } from "@/lib/server/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyzeReportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analyze-report payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const analysis = await analyzeReportWithClaude(parsed.data);
  const strict = analyzeReportResponseSchema.parse(analysis);

  return NextResponse.json(strict);
}
