import { beforeEach, describe, expect, it } from "vitest";

import { GET as getReviewInbox } from "../src/app/api/review/inbox/route";
import { POST as createReport } from "../src/app/api/reports/route";
import { POST as deepenReport } from "../src/app/api/reports/deepen/route";
import { resetKnowledgeStackStoreForTests } from "../src/lib/server/knowledge-stack-store";
import { createProblem, resetProblemsStoreForTests } from "../src/lib/server/problems-store";
import { resetReportStoreForTests } from "../src/lib/server/report-store";
import { createAttempt, createSession, resetSolveStoreForTests } from "../src/lib/server/solve-store";
import { resetSummaryBookletStoreForTests } from "../src/lib/server/summary-booklet-store";

beforeEach(() => {
  resetProblemsStoreForTests();
  resetSolveStoreForTests();
  resetReportStoreForTests();
  resetKnowledgeStackStoreForTests();
  resetSummaryBookletStoreForTests();
});

function seedAttemptContext(stem: string): string {
  const problem = createProblem({
    section: "verbal",
    sub_type: "cr_inference",
    difficulty: "medium",
    content: {
      stem,
      choices: ["A", "B", "C", "D", "E"],
      answer_index: 2,
    },
    tags: [],
    source: "manual_capture",
  });
  const session = createSession({
    session_type: "sprint_verbal",
    duration_planned_min: 45,
    problem_ids: [problem.id],
    meta: {},
  });
  const attempt = createAttempt({
    problem_id: problem.id,
    session_id: session.id,
    user_answer: 0,
    is_correct: false,
    time_spent_sec: 88,
    exceeded_cutoff: false,
    confidence: "unsure",
    pre_think: null,
  });
  return attempt.id;
}

describe("review inbox api", () => {
  it("returns an empty-safe inbox snapshot", async () => {
    const response = await getReviewInbox();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      counts: {
        total_reports: number;
        pending_deep: number;
        due_self_test: number;
        recent_deep: number;
        answer_flows: number;
      };
      pending_deep: unknown[];
      due_self_test: unknown[];
      recent_deep: unknown[];
      answer_flows: unknown[];
      next_actions: Array<{ type: string; href: string; count: number }>;
    };

    expect(payload.counts.total_reports).toBe(0);
    expect(payload.counts.pending_deep).toBe(0);
    expect(payload.counts.due_self_test).toBe(0);
    expect(payload.counts.answer_flows).toBe(0);
    expect(payload.pending_deep).toHaveLength(0);
    expect(payload.due_self_test).toHaveLength(0);
    expect(payload.answer_flows).toHaveLength(0);
    expect(payload.next_actions).toEqual([
      { type: "summary", href: "/summary?version=today", count: 0, label: "오늘 요약집 점검" },
    ]);
  });

  it("classifies pending deep, due self test, recent deep, and answer flows", async () => {
    const quickAttemptId = seedAttemptContext("Quick report problem");
    const quick = await createReport(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: quickAttemptId,
          my_frame: "선지 표현 유사성에 끌렸다.",
          correct_mechanism: "결론과 직접 연결되는 근거를 봐야 했다.",
          next_tool: "Q: 결론을 직접 건드리나? -> F: 연결 근거",
          failure_stage: "strategy",
          error_type: "attractive_choice",
          save_as_rule: false,
        }),
      }),
    );
    expect(quick.status).toBe(201);

    const quickPayload = (await quick.json()) as { report: { id: string } };

    const deepAttemptId = seedAttemptContext("Deep report problem");
    const deepSource = await createReport(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: deepAttemptId,
          my_frame: "결론을 다시 안 쓰고 선지부터 봤다.",
          correct_mechanism: "대안 원인을 제거해 인과를 강화했다.",
          next_tool: "Q: alternative cause? -> F: causation only",
          failure_stage: "strategy",
          error_type: "scope",
          save_as_rule: true,
        }),
      }),
    );
    expect(deepSource.status).toBe(201);
    const deepSourcePayload = (await deepSource.json()) as { report: { id: string } };

    const deepened = await deepenReport(
      new Request("http://localhost/api/reports/deepen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: deepSourcePayload.report.id,
          mechanism_english: "Eliminate alternative causes to strengthen causation.",
          logic_comparison: "내 인출: 표현 유사성 -> 정답 논리: 대안 원인 제거",
          generate_ai: false,
        }),
      }),
    );
    expect(deepened.status).toBe(200);

    const response = await getReviewInbox();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      counts: {
        total_reports: number;
        pending_deep: number;
        due_self_test: number;
        recent_deep: number;
        answer_flows: number;
      };
      pending_deep: Array<{ id: string; report_mode: string }>;
      due_self_test: Array<{ report: { id: string }; review_queue_id: string }>;
      recent_deep: Array<{ id: string; report_mode: string }>;
      answer_flows: Array<{ source_report_id: string | null; mechanism: string }>;
      next_actions: Array<{ type: string; href: string; count: number }>;
    };

    expect(payload.counts.total_reports).toBe(2);
    expect(payload.counts.pending_deep).toBe(1);
    expect(payload.counts.due_self_test).toBeGreaterThanOrEqual(2);
    expect(payload.counts.recent_deep).toBe(1);
    expect(payload.counts.answer_flows).toBeGreaterThanOrEqual(1);
    expect(payload.pending_deep.some((report) => report.id === quickPayload.report.id)).toBe(true);
    expect(payload.due_self_test.length).toBeGreaterThanOrEqual(1);
    expect(payload.recent_deep.some((report) => report.id === deepSourcePayload.report.id)).toBe(true);
    expect(
      payload.answer_flows.some((flow) => flow.source_report_id === deepSourcePayload.report.id),
    ).toBe(true);
    expect(
      payload.next_actions.some((action) => action.type === "deepen" && action.href === "/review/deepen"),
    ).toBe(true);
    expect(
      payload.next_actions.some(
        (action) => action.type === "self_test" && action.href === "/review/reports",
      ),
    ).toBe(true);
  });
});
