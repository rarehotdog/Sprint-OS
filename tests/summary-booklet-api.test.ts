import { beforeEach, describe, expect, it } from "vitest";

import { GET as getSummaryBooklet } from "../src/app/api/summary/booklet/route";
import { POST as buildSummaryBooklet } from "../src/app/api/summary/booklet/build/route";
import { GET as exportSummaryBooklet } from "../src/app/api/summary/booklet/export/route";
import { createProblem, resetProblemsStoreForTests } from "../src/lib/server/problems-store";
import { createQuickReport, deepenReport, resetReportStoreForTests } from "../src/lib/server/report-store";
import { resetSummaryBookletStoreForTests } from "../src/lib/server/summary-booklet-store";
import {
  createAttempt,
  createSession,
  resetSolveStoreForTests,
} from "../src/lib/server/solve-store";

function buildPostRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetProblemsStoreForTests();
  resetSolveStoreForTests();
  resetReportStoreForTests();
  resetSummaryBookletStoreForTests();
});

async function seedOneDeepReport(): Promise<void> {
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
    source: "ai_generated",
  });

  const session = createSession({
    session_type: "sprint_verbal",
    recipe: "seed",
    duration_planned_min: 30,
    meta: {},
  });

  const attempt = createAttempt({
    session_id: session.id,
    problem_id: problem.id,
    user_answer: 1,
    is_correct: false,
    time_spent_sec: 132,
    exceeded_cutoff: true,
    confidence: "unsure",
    pre_think: null,
  });

  const quick = createQuickReport({
    attempt_id: attempt.id,
    report_mode: "quick",
    my_frame: "결론을 다시 쓰지 않고 선지부터 비교했다.",
    correct_mechanism: "대안 원인 제거로 인과 링크를 강화했다.",
    next_tool: "Q: 대안 원인을 제거했는가? -> F: 인과 링크만 검증",
    failure_stage: "strategy",
    error_type: "attractive_choice",
    save_as_rule: true,
  });

  deepenReport({
    report_id: quick.report.id,
    mechanism_english: "Eliminate alternative causes to strengthen causation.",
    logic_comparison: "내 인출: 표현 유사성 -> 정답 논리: 대안 원인 제거",
    generate_ai: false,
    sub_report: null,
  });
}

describe("summary booklet api", () => {
  it("rejects invalid build payload", async () => {
    const response = await buildSummaryBooklet(
      buildPostRequest("http://localhost/api/summary/booklet/build", {
        trigger: "invalid",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns empty-safe booklet when no data exists", async () => {
    const response = await getSummaryBooklet(
      new Request("http://localhost/api/summary/booklet?version=eve"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      version: string;
      diagnostics: { source_counts: { total_reports: number; deep_reports: number } };
      sections: { concepts: string[]; checklist: string[] };
    };

    expect(payload.version).toBe("eve");
    expect(payload.diagnostics.source_counts.total_reports).toBe(0);
    expect(payload.diagnostics.source_counts.deep_reports).toBe(0);
    expect(payload.sections.concepts.length).toBeGreaterThan(0);
    expect(payload.sections.checklist.length).toBeGreaterThan(0);
  });

  it("builds eve/day variants and returns section counts", async () => {
    await seedOneDeepReport();

    const response = await buildSummaryBooklet(
      buildPostRequest("http://localhost/api/summary/booklet/build", {
        trigger: "consolidation",
        version: "both",
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      builds: Array<{
        version: string;
        sections_count: number;
        source_counts: { deep_reports: number; rules: number };
      }>;
    };

    expect(payload.builds).toHaveLength(2);
    expect(payload.builds.map((item) => item.version).sort()).toEqual(["day", "eve"]);
    expect(payload.builds.every((item) => item.sections_count > 0)).toBe(true);
    expect(payload.builds.every((item) => item.source_counts.deep_reports >= 1)).toBe(true);
    expect(payload.builds.every((item) => item.source_counts.rules >= 1)).toBe(true);
  });

  it("builds all variants including today", async () => {
    await seedOneDeepReport();

    const response = await buildSummaryBooklet(
      buildPostRequest("http://localhost/api/summary/booklet/build", {
        trigger: "manual",
        version: "all",
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      builds: Array<{ version: string; sections_count: number }>;
    };

    expect(payload.builds.map((item) => item.version).sort()).toEqual(["day", "eve", "today"]);
    expect(payload.builds.every((item) => item.sections_count > 0)).toBe(true);
  });

  it("exports markdown booklet with strict response keys", async () => {
    await seedOneDeepReport();
    await buildSummaryBooklet(
      buildPostRequest("http://localhost/api/summary/booklet/build", {
        trigger: "manual",
        version: "day",
      }),
    );

    const response = await exportSummaryBooklet(
      new Request("http://localhost/api/summary/booklet/export?version=day&format=markdown"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { filename: string; content: string };

    expect(payload.filename).toContain("day");
    expect(payload.filename.endsWith(".md")).toBe(true);
    expect(payload.content).toContain("# GMAT 805 DAY 요약집");
  });
});
