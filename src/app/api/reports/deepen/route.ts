import { NextResponse } from "next/server";

import { deepenReportSchema } from "@/lib/contracts/report-contracts";
import { analyzeReportWithClaude } from "@/lib/server/ai";
import { promoteDeepReportToKnowledgeStack } from "@/lib/server/knowledge-stack-store";
import { attachAiAnalysis, deepenReport } from "@/lib/server/report-store";
import { buildSummaryBooklet } from "@/lib/server/summary-booklet-store";

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
      try {
        promoteDeepReportToKnowledgeStack(deepened);
      } catch {
        // Preserve deepen success even when promotion fails.
      }
      // Consolidation step completed: refresh booklet snapshots in background.
      try {
        buildSummaryBooklet({ trigger: "consolidation", version: "all" });
      } catch {
        // Preserve deepen success even when booklet refresh fails.
      }
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

    try {
      promoteDeepReportToKnowledgeStack(updated);
    } catch {
      // Preserve deepen success even when promotion fails.
    }

    try {
      buildSummaryBooklet({ trigger: "consolidation", version: "all" });
    } catch {
      // Preserve deepen success even when booklet refresh fails.
    }

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
