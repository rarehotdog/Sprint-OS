import { beforeEach, describe, expect, it } from "vitest";

import { GET as getReviewReports } from "../src/app/api/review/reports/route";
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
    sub_type: "cr_strengthen",
    difficulty: "medium",
    content: {
      stem,
      choices: ["A", "B", "C", "D", "E"],
      answer_index: 1,
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
    time_spent_sec: 91,
    exceeded_cutoff: false,
    confidence: "guessed",
    pre_think: null,
  });
  return attempt.id;
}

describe("review reports api", () => {
  it("returns empty-safe workbench payload", async () => {
    const response = await getReviewReports(
      new Request("http://localhost/api/review/reports?limit=5"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      inbox: { counts: { total_reports: number } };
      reports: unknown[];
      selected_report: {
        report: null;
        answer_flow: null;
        summary_cards: unknown[];
        review_queue: null;
      };
      filters_applied: { mode: string | null; report_id: string | null; limit: number };
    };

    expect(payload.inbox.counts.total_reports).toBe(0);
    expect(payload.reports).toHaveLength(0);
    expect(payload.selected_report.report).toBeNull();
    expect(payload.selected_report.answer_flow).toBeNull();
    expect(payload.selected_report.summary_cards).toHaveLength(0);
    expect(payload.selected_report.review_queue).toBeNull();
    expect(payload.filters_applied.limit).toBe(5);
  });

  it("returns inbox, filtered previews, and selected deep detail", async () => {
    const quickAttemptId = seedAttemptContext("Quick review context");
    const quick = await createReport(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: quickAttemptId,
          my_frame: "결론을 다시 안 쓰고 선지로 바로 갔다.",
          correct_mechanism: "질문 요구와 결론 연결을 먼저 봐야 했다.",
          next_tool: "Q: 결론 직접 연결? -> F: 요구 재진술",
          failure_stage: "strategy",
          error_type: "scope",
        }),
      }),
    );
    expect(quick.status).toBe(201);

    const deepAttemptId = seedAttemptContext("Deep review context");
    const deepSource = await createReport(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: deepAttemptId,
          my_frame: "표현 유사성에 끌렸다.",
          correct_mechanism: "대안 원인을 제거해야 했다.",
          next_tool: "Q: 대안 원인? -> F: 인과 링크만 검증",
          failure_stage: "strategy",
          error_type: "attractive_choice",
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
          mechanism_english: "Eliminate alternative causes to support the causal claim.",
          logic_comparison: "내 인출: 표현유사 -> 정답 논리: 대안 원인 제거",
          generate_ai: false,
        }),
      }),
    );
    expect(deepened.status).toBe(200);

    const response = await getReviewReports(
      new Request(
        `http://localhost/api/review/reports?mode=deep&report_id=${deepSourcePayload.report.id}&limit=10`,
      ),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      inbox: { counts: { total_reports: number; pending_deep: number } };
      reports: Array<{ id: string; report_mode: string }>;
      selected_report: {
        report: { id: string; report_mode: string; review_queue_id: string | null };
        answer_flow: { report_id: string | null; mechanism: string } | null;
        summary_cards: Array<{ source_report_id: string | null; card_type: string; content: string }>;
        review_queue: { review_queue_id: string; next_review_at: string; interval_days: number } | null;
      };
      filters_applied: { mode: string | null; report_id: string | null; limit: number };
    };

    expect(payload.inbox.counts.total_reports).toBe(2);
    expect(payload.inbox.counts.pending_deep).toBe(1);
    expect(payload.reports).toHaveLength(1);
    expect(payload.reports[0]?.id).toBe(deepSourcePayload.report.id);
    expect(payload.reports[0]?.report_mode).toBe("deep");
    expect(payload.selected_report.report.id).toBe(deepSourcePayload.report.id);
    expect(payload.selected_report.answer_flow?.report_id).toBe(deepSourcePayload.report.id);
    expect(
      payload.selected_report.summary_cards.some(
        (card) => card.source_report_id === deepSourcePayload.report.id,
      ),
    ).toBe(true);
    expect(payload.selected_report.review_queue?.review_queue_id).toBeTruthy();
    expect(payload.filters_applied.mode).toBe("deep");
    expect(payload.filters_applied.report_id).toBe(deepSourcePayload.report.id);
    expect(payload.filters_applied.limit).toBe(10);
  });

  it("rejects invalid query", async () => {
    const response = await getReviewReports(
      new Request("http://localhost/api/review/reports?mode=invalid"),
    );

    expect(response.status).toBe(400);
  });
});
