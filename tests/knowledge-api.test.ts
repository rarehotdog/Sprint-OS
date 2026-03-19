import { beforeEach, describe, expect, it } from "vitest";

import { GET as getAnswerFlows } from "../src/app/api/knowledge/answer-flows/route";
import { GET as getSummaryCards } from "../src/app/api/knowledge/summary-cards/route";
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
  resetSummaryBookletStoreForTests();
  resetKnowledgeStackStoreForTests();
});

function seedAttemptContext(): string {
  const problem = createProblem({
    section: "verbal",
    sub_type: "cr_strengthen",
    difficulty: "medium",
    content: {
      stem: "Which choice most strengthens the argument?",
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
    time_spent_sec: 92,
    exceeded_cutoff: false,
    confidence: "unsure",
    pre_think: null,
  });
  return attempt.id;
}

describe("knowledge api", () => {
  it("rejects invalid limit query", async () => {
    const response = await getAnswerFlows(
      new Request("http://localhost/api/knowledge/answer-flows?limit=0"),
    );

    expect(response.status).toBe(400);
  });

  it("returns promoted answer flows and summary cards with source trace", async () => {
    const attemptId = seedAttemptContext();
    const created = await createReport(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: attemptId,
          my_frame: "결론을 재진술하지 않고 바로 선지를 봤다.",
          correct_mechanism: "대안 원인을 제거해 인과를 강화했다.",
          next_tool: "Q: 대안원인? -> F: 인과링크 유지",
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
          mechanism_english: "Eliminate alternative causes to support causation.",
          logic_comparison: "내 인출: 표현유사 -> 정답논리: 대안원인 제거",
          generate_ai: false,
        }),
      }),
    );
    expect(deepened.status).toBe(200);

    const flowsResponse = await getAnswerFlows(
      new Request("http://localhost/api/knowledge/answer-flows?limit=3"),
    );
    expect(flowsResponse.status).toBe(200);
    const flowPayload = (await flowsResponse.json()) as {
      items: Array<{ report_id: string | null; ask: string; key_factor: string; mechanism: string; check: string }>;
      total: number;
    };

    expect(flowPayload.total).toBeGreaterThanOrEqual(1);
    expect(flowPayload.items.length).toBeGreaterThanOrEqual(1);
    expect(flowPayload.items[0]?.report_id).toBe(createdPayload.report.id);
    expect(flowPayload.items[0]?.ask.length).toBeGreaterThan(0);
    expect(flowPayload.items[0]?.key_factor.length).toBeGreaterThan(0);
    expect(flowPayload.items[0]?.mechanism.length).toBeGreaterThan(0);
    expect(flowPayload.items[0]?.check.length).toBeGreaterThan(0);

    const cardsResponse = await getSummaryCards(
      new Request("http://localhost/api/knowledge/summary-cards?limit=3"),
    );
    expect(cardsResponse.status).toBe(200);
    const cardPayload = (await cardsResponse.json()) as {
      items: Array<{ source_report_id: string | null; card_type: string; content: string }>;
      total: number;
    };

    expect(cardPayload.total).toBeGreaterThanOrEqual(1);
    expect(cardPayload.items.length).toBeGreaterThanOrEqual(1);
    expect(cardPayload.items.some((card) => card.source_report_id === createdPayload.report.id)).toBe(
      true,
    );
    expect(cardPayload.items[0]?.card_type.length).toBeGreaterThan(0);
    expect(cardPayload.items[0]?.content.length).toBeGreaterThan(0);
  });
});
