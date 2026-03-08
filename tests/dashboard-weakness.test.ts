import { describe, expect, it } from "vitest";

import { GET } from "../src/app/api/dashboard/weakness/route";
import { createProblem, resetProblemsStoreForTests } from "../src/lib/server/problems-store";
import { createQuickReport, resetReportStoreForTests } from "../src/lib/server/report-store";
import {
  createAttempt,
  createSession,
  resetSolveStoreForTests,
} from "../src/lib/server/solve-store";

describe("dashboard weakness api", () => {
  it("returns empty-safe payload", async () => {
    resetProblemsStoreForTests();
    resetSolveStoreForTests();
    resetReportStoreForTests();

    const response = await GET(new Request("http://localhost/api/dashboard/weakness?days=7"));
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      summary: { total_attempts: number; total_reports: number };
      section_accuracy: unknown[];
      subtype_weakness: unknown[];
      error_distribution: unknown[];
      trend: unknown[];
    };

    expect(payload.summary.total_attempts).toBe(0);
    expect(payload.summary.total_reports).toBe(0);
    expect(payload.section_accuracy).toHaveLength(0);
    expect(payload.subtype_weakness).toHaveLength(0);
    expect(payload.error_distribution).toHaveLength(0);
    expect(payload.trend).toHaveLength(7);
  });

  it("aggregates attempts and reports with filters", async () => {
    resetProblemsStoreForTests();
    resetSolveStoreForTests();
    resetReportStoreForTests();

    const verbal = createProblem({
      section: "verbal",
      sub_type: "cr_strengthen",
      difficulty: "hard",
      content: {
        stem: "Which choice strengthens the argument?",
        choices: ["A", "B", "C", "D", "E"],
      },
      tags: ["ai_generated"],
      source: "ai_generated",
    });

    const quant = createProblem({
      section: "quant",
      sub_type: "algebra",
      difficulty: "medium",
      content: {
        stem: "If x + 2 = 10, x = ?",
        choices: ["6", "7", "8", "9", "10"],
      },
      tags: ["manual_capture"],
      source: "manual_capture",
    });

    const session = createSession({
      session_type: "mock_section",
      recipe: null,
      duration_planned_min: 45,
      meta: {},
    });

    const attempt1 = createAttempt({
      session_id: session.id,
      problem_id: verbal.id,
      user_answer: 3,
      is_correct: true,
      time_spent_sec: 80,
      exceeded_cutoff: false,
      confidence: "sure",
      pre_think: null,
    });

    const attempt2 = createAttempt({
      session_id: session.id,
      problem_id: verbal.id,
      user_answer: 1,
      is_correct: false,
      time_spent_sec: 160,
      exceeded_cutoff: true,
      confidence: "unsure",
      pre_think: null,
    });

    const attempt3 = createAttempt({
      session_id: session.id,
      problem_id: quant.id,
      user_answer: 0,
      is_correct: false,
      time_spent_sec: 140,
      exceeded_cutoff: false,
      confidence: "unsure",
      pre_think: null,
    });

    createQuickReport({
      attempt_id: attempt2.id,
      report_mode: "quick",
      my_frame: "verbal frame",
      correct_mechanism: "verbal mechanism",
      next_tool: "verbal tool",
      failure_stage: "strategy",
      error_type: "scope",
      save_as_rule: false,
    });

    createQuickReport({
      attempt_id: attempt3.id,
      report_mode: "quick",
      my_frame: "quant frame",
      correct_mechanism: "quant mechanism",
      next_tool: "quant tool",
      failure_stage: "calculation",
      error_type: "arithmetic",
      save_as_rule: false,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/weakness?days=30&section=verbal&source=ai_generated",
      ),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      summary: { total_attempts: number; total_reports: number; accuracy: number };
      section_accuracy: Array<{ section: string; total: number; accuracy: number }>;
      subtype_weakness: Array<{ sub_type: string; total: number; incorrect: number }>;
      error_distribution: Array<{ section: string; count: number; ratio: number }>;
      filters_applied: { section: string | null; source: string | null };
    };

    expect(payload.summary.total_attempts).toBe(2);
    expect(payload.summary.total_reports).toBe(1);
    expect(payload.summary.accuracy).toBe(0.5);

    expect(payload.section_accuracy).toHaveLength(1);
    expect(payload.section_accuracy[0]?.section).toBe("verbal");
    expect(payload.section_accuracy[0]?.total).toBe(2);

    expect(payload.subtype_weakness).toHaveLength(1);
    expect(payload.subtype_weakness[0]?.sub_type).toBe("cr_strengthen");
    expect(payload.subtype_weakness[0]?.incorrect).toBe(1);

    expect(payload.error_distribution).toHaveLength(1);
    expect(payload.error_distribution[0]?.section).toBe("verbal");
    expect(payload.error_distribution[0]?.count).toBe(1);
    expect(payload.error_distribution[0]?.ratio).toBe(1);

    expect(payload.filters_applied.section).toBe("verbal");
    expect(payload.filters_applied.source).toBe("ai_generated");

    // Ensure filtered-out quant attempts do not leak into verbal-only summary.
    expect(payload.summary.total_attempts).not.toBe(3);
  });

  it("returns 400 for invalid query", async () => {
    const response = await GET(
      new Request("http://localhost/api/dashboard/weakness?section=invalid"),
    );

    expect(response.status).toBe(400);
  });
});
