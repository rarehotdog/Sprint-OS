import { beforeEach, describe, expect, it } from "vitest";

import { GET } from "../src/app/api/review/summary/route";
import { resetCalendarStoreForTests } from "../src/lib/server/calendar-store";
import { resetDailyLogStoreForTests } from "../src/lib/server/daily-log-store";
import { createProblem, resetProblemsStoreForTests } from "../src/lib/server/problems-store";
import { createQuickReport, deepenReport, resetReportStoreForTests } from "../src/lib/server/report-store";
import {
  createAttempt,
  createSession,
  resetSolveStoreForTests,
} from "../src/lib/server/solve-store";

beforeEach(() => {
  resetProblemsStoreForTests();
  resetSolveStoreForTests();
  resetReportStoreForTests();
  resetCalendarStoreForTests();
  resetDailyLogStoreForTests();
});

async function seedSummaryData() {
  const problem = createProblem({
    section: "verbal",
    sub_type: "cr_strengthen",
    difficulty: "hard",
    content: {
      stem: "Which choice most strengthens the argument?",
      choices: ["A", "B", "C", "D", "E"],
      answer_index: 3,
    },
    tags: ["cr_strengthen"],
    source: "manual_capture",
  });

  const session = createSession({
    session_type: "sprint_verbal",
    recipe: null,
    duration_planned_min: 30,
    meta: {},
  });

  const attempt = createAttempt({
    session_id: session.id,
    problem_id: problem.id,
    user_answer: 1,
    is_correct: false,
    time_spent_sec: 155,
    exceeded_cutoff: true,
    confidence: "unsure",
    pre_think: null,
  });

  const quick = createQuickReport({
    attempt_id: attempt.id,
    report_mode: "quick",
    my_frame: "결론 검증 없이 매력 선지로 이동",
    correct_mechanism: "대안 원인을 제거하는 선택지가 정답",
    next_tool: "Q: alternative cause 제거? -> F: 인과 링크 직접 검증",
    failure_stage: "strategy",
    error_type: "attractive_choice",
    save_as_rule: true,
  });

  deepenReport({
    report_id: quick.report.id,
    mechanism_english: "Eliminate alternative cause to strengthen causation.",
    logic_comparison: "내 인출: 문장 유사성 -> 정답 논리: 인과 링크 강화",
    sub_report: null,
    generate_ai: false,
  });
}

describe("review summary api", () => {
  it("returns 400 for invalid mode", async () => {
    const response = await GET(
      new Request("http://localhost/api/review/summary?mode=invalid"),
    );

    expect(response.status).toBe(400);
  });

  it("returns safe payload when no data exists", async () => {
    const response = await GET(new Request("http://localhost/api/review/summary"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-deprecated")).toBe("true");

    const payload = (await response.json()) as {
      version: string;
      diagnostics: {
        source_counts: { total_reports: number; quick_reports: number; deep_reports: number };
        weak_subtypes: unknown[];
        error_patterns: unknown[];
      };
      sections: { checklist: unknown[] };
    };

    expect(payload.version).toBe("eve");
    expect(payload.diagnostics.source_counts.total_reports).toBe(0);
    expect(payload.diagnostics.source_counts.quick_reports).toBe(0);
    expect(payload.diagnostics.source_counts.deep_reports).toBe(0);
    expect(payload.diagnostics.weak_subtypes).toHaveLength(0);
    expect(payload.diagnostics.error_patterns).toHaveLength(0);
    expect(payload.sections.checklist.length).toBeGreaterThan(0);
  });

  it("returns populated summary shape for exam day mode", async () => {
    await seedSummaryData();

    const response = await GET(
      new Request("http://localhost/api/review/summary?mode=exam_day&days=14"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-deprecated")).toBe("true");

    const payload = (await response.json()) as {
      version: string;
      summary: string;
      diagnostics: {
        source_counts: { total_reports: number; rules: number; deep_reports: number };
        weak_subtypes: Array<{ section: string; sub_type: string }>;
      };
      sections: { concepts: string[]; checklist: string[] };
    };

    expect(payload.version).toBe("day");
    expect(payload.summary.length).toBeGreaterThan(0);
    expect(payload.diagnostics.source_counts.total_reports).toBeGreaterThanOrEqual(1);
    expect(payload.diagnostics.source_counts.rules).toBeGreaterThanOrEqual(1);
    expect(payload.diagnostics.source_counts.deep_reports).toBeGreaterThanOrEqual(1);
    expect(payload.diagnostics.weak_subtypes.length).toBeGreaterThan(0);
    expect(payload.sections.concepts.length).toBeGreaterThan(0);
    expect(payload.sections.checklist.length).toBeGreaterThan(0);
  });
});
