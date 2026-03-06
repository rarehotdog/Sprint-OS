import { NextResponse } from "next/server";

import { deepenReportSchema } from "@/lib/contracts/report-contracts";
import { analyzeReportWithClaude } from "@/lib/server/ai";
import { attachAiAnalysis, deepenReport } from "@/lib/server/report-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = deepenReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid deepen payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const deepened = deepenReport(parsed.data);

    if (!parsed.data.generate_ai) {
      return NextResponse.json({ report: deepened, ai_analysis: null });
    }

    const aiAnalysis = await analyzeReportWithClaude({
      my_frame: deepened.my_frame,
      correct_mechanism: deepened.correct_mechanism,
      next_tool: deepened.next_tool,
      mechanism_english: deepened.mechanism_english,
      logic_comparison: deepened.logic_comparison,
      sub_report: deepened.sub_report,
    });

    const updated = attachAiAnalysis(deepened.id, aiAnalysis);

    return NextResponse.json({
      report: updated,
      ai_analysis: aiAnalysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Report not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
