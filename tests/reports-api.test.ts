import { describe, expect, it } from "vitest";

import { GET, POST } from "../src/app/api/reports/route";
import { resetReportStoreForTests } from "../src/lib/server/report-store";

describe("reports api", () => {
  it("returns one report by report_id", async () => {
    resetReportStoreForTests();

    const create = await POST(
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
          save_as_rule: false,
        }),
      }),
    );

    const created = (await create.json()) as { report: { id: string } };

    const response = await GET(
      new Request(`http://localhost/api/reports?report_id=${created.report.id}`),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { report: { id: string } };
    expect(payload.report.id).toBe(created.report.id);
  });

  it("filters by mode and supports limit", async () => {
    resetReportStoreForTests();

    for (let index = 0; index < 3; index += 1) {
      await POST(
        new Request("http://localhost/api/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attempt_id: crypto.randomUUID(),
            my_frame: `frame-${index}`,
            correct_mechanism: "mechanism",
            next_tool: "tool",
            failure_stage: "reading",
            error_type: "scope",
            save_as_rule: false,
          }),
        }),
      );
    }

    const response = await GET(
      new Request("http://localhost/api/reports?mode=quick&limit=2"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      reports: Array<{ report_mode: string }>;
      pending_deep: unknown[];
    };

    expect(payload.reports).toHaveLength(2);
    expect(payload.reports.every((report) => report.report_mode === "quick")).toBe(true);
    expect(Array.isArray(payload.pending_deep)).toBe(true);
  });
});
