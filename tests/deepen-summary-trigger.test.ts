import { beforeEach, describe, expect, it } from "vitest";

import { POST as deepenReport } from "../src/app/api/reports/deepen/route";
import { POST as createReport } from "../src/app/api/reports/route";
import { GET as getSummaryBooklet } from "../src/app/api/summary/booklet/route";
import {
  listAnswerFlows,
  listSummaryCards,
  resetKnowledgeStackStoreForTests,
} from "../src/lib/server/knowledge-stack-store";
import { resetReportStoreForTests } from "../src/lib/server/report-store";
import { resetSummaryBookletStoreForTests } from "../src/lib/server/summary-booklet-store";

beforeEach(() => {
  resetReportStoreForTests();
  resetSummaryBookletStoreForTests();
  resetKnowledgeStackStoreForTests();
});

describe("deepen -> summary trigger", () => {
  it("auto-refreshes booklet after deepen", async () => {
    const created = await createReport(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: crypto.randomUUID(),
          my_frame: "frame",
          correct_mechanism: "mechanism",
          next_tool: "tool",
          failure_stage: "strategy",
          error_type: "scope",
          save_as_rule: true,
        }),
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { report: { id: string } };

    const deepened = await deepenReport(
      new Request("http://localhost/api/reports/deepen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: createdPayload.report.id,
          mechanism_english: "Mechanism in English",
          logic_comparison: "logic compare",
          generate_ai: false,
        }),
      }),
    );
    expect(deepened.status).toBe(200);

    const summary = await getSummaryBooklet(
      new Request("http://localhost/api/summary/booklet?version=eve"),
    );
    expect(summary.status).toBe(200);
    const summaryPayload = (await summary.json()) as {
      diagnostics: { source_counts: { deep_reports: number; rules: number } };
    };
    expect(summaryPayload.diagnostics.source_counts.deep_reports).toBeGreaterThanOrEqual(1);
    expect(summaryPayload.diagnostics.source_counts.rules).toBeGreaterThanOrEqual(1);

    const todaySummary = await getSummaryBooklet(
      new Request("http://localhost/api/summary/booklet?version=today"),
    );
    expect(todaySummary.status).toBe(200);
    const todayPayload = (await todaySummary.json()) as {
      sections: { process_flows: string[] };
    };
    expect(todayPayload.sections.process_flows.some((item) => item.includes("Ask:"))).toBe(true);

    const flows = listAnswerFlows();
    const cards = listSummaryCards();
    expect(flows.length).toBeGreaterThanOrEqual(1);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards.some((card) => card.source_report_id === createdPayload.report.id)).toBe(true);
  });
});
