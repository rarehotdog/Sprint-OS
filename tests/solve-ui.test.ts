import { describe, expect, it } from "vitest";

import {
  buildAutoDeepenPayload,
  buildConceptSupportCard,
  buildMicroQuickDraft,
  buildQuickReportDraft,
  buildQuickReportPayload,
  buildSolveRecoverySnapshot,
  getSolveEmptyState,
  getSolveReviewDestination,
  mapAttemptToRecall,
  shouldAutoDeepenAttempt,
  parseSolveQueryFallbacks,
  resolveSolveSubmission,
} from "../src/lib/solve-ui";
import type { Problem, SessionDetailResponse } from "../src/lib/types";

function makeProblem(id: string, section: "verbal" | "quant" | "di"): Problem {
  return {
    id,
    section,
    sub_type: `${section}_type`,
    difficulty: "medium",
    content: {
      stem: `${section} stem`,
      choices: ["A", "B", "C", "D"],
      answer_index: 1,
    },
    tags: [],
    source: "test",
    source_type: "manual",
    source_name: "Test Bank",
    source_url: null,
    external_id: null,
    license_note: null,
    parser_confidence: null,
    curation_status: "accepted",
    corpus_tier: "gold",
    canonical_hash: null,
    difficulty_estimate: "medium",
    explanation_quality: null,
    import_batch_id: null,
    last_curated_at: null,
    curated_by: null,
    created_at: new Date().toISOString(),
  };
}

function makeDetail(): SessionDetailResponse {
  return {
    session: {
      id: "11111111-1111-1111-1111-111111111111",
      session_type: "mock_full",
      recipe: null,
      duration_planned_min: 135,
      duration_actual_min: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      meta: {},
    },
    run_state: {
      session_id: "11111111-1111-1111-1111-111111111111",
      ordered_problem_ids: [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "cccccccc-cccc-cccc-cccc-cccccccccccc",
      ],
      attempted_problem_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
      attempted_count: 1,
      total_count: 3,
      current_index: 1,
      next_problem_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      completed: false,
    },
    solve_context: {
      section_hint: "verbal",
      duration_planned_min: 135,
      section_order: ["verbal", "quant", "di"],
      section_bounds: [
        { section: "verbal", start_index: 0, end_index: 1 },
        { section: "quant", start_index: 1, end_index: 2 },
        { section: "di", start_index: 2, end_index: 3 },
      ],
    },
  };
}

describe("solve ui helpers", () => {
  it("prefers run_state over deep-link q fallback", () => {
    const detail = makeDetail();
    const problems = [
      makeProblem("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "verbal"),
      makeProblem("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "quant"),
      makeProblem("cccccccc-cccc-cccc-cccc-cccccccccccc", "di"),
    ];
    const fallbacks = parseSolveQueryFallbacks(
      new URLSearchParams("q=3&section=di&duration=45"),
    );

    const snapshot = buildSolveRecoverySnapshot(detail, problems, fallbacks);

    expect(snapshot.activeIndex).toBe(1);
    expect(snapshot.questionNumber).toBe(2);
    expect(snapshot.activeProblem?.id).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(snapshot.currentSection).toBe("quant");
    expect(snapshot.durationMinutes).toBe(135);
  });

  it("routes completed sessions to summary page", () => {
    const destination = getSolveReviewDestination("session-123", {
      session_id: "11111111-1111-1111-1111-111111111111",
      ordered_problem_ids: [],
      attempted_problem_ids: [],
      attempted_count: 0,
      total_count: 0,
      current_index: 0,
      next_problem_id: null,
      completed: true,
    });

    expect(destination.href).toBe("/summary?version=today");
    expect(destination.label).toBe("세션 요약집 보기");
  });

  it("requires an explicit self-reported result when no answer_index exists", () => {
    const resolution = resolveSolveSubmission({
      answerIndex: null,
      selectedAnswer: null,
      selfReportedCorrect: null,
    });

    expect(resolution.isCorrect).toBeNull();
    expect(resolution.error).toContain("정답 여부");
  });

  it("computes correctness from the selected answer when answer_index exists", () => {
    const resolution = resolveSolveSubmission({
      answerIndex: 2,
      selectedAnswer: 2,
      selfReportedCorrect: null,
    });

    expect(resolution.isCorrect).toBe(true);
    expect(resolution.error).toBeNull();
  });

  it("builds a quick report draft from the latest attempt context", () => {
    const draft = buildQuickReportDraft(
      {
        id: "attempt-1",
        problem_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        session_id: "11111111-1111-1111-1111-111111111111",
        user_answer: 1,
        is_correct: false,
        time_spent_sec: 95,
        exceeded_cutoff: false,
        confidence: "unsure",
        pre_think: null,
        attempted_at: new Date().toISOString(),
      },
      makeProblem("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "verbal"),
    );

    expect(draft.my_frame).toContain("verbal_type");
    expect(draft.correct_mechanism).toContain("정답");
    expect(draft.next_tool).toContain("질문 요구");
    expect(draft.failure_stage).toBe("strategy");
  });

  it("builds actionable empty state for sessions without ordered problems", () => {
    const detail = makeDetail();
    detail.run_state.ordered_problem_ids = [];
    detail.run_state.total_count = 0;
    detail.run_state.next_problem_id = null;
    detail.solve_context.section_hint = "di";

    const emptyState = getSolveEmptyState(detail);

    expect(emptyState?.section).toBe("di");
    expect(emptyState?.problemsHref).toBe("/problems?section=di");
  });

  it("builds a micro quick payload and auto-deepen trigger from an unsure attempt", () => {
    const attempt = {
      id: "attempt-1",
      problem_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      session_id: "11111111-1111-1111-1111-111111111111",
      user_answer: 1,
      is_correct: false,
      time_spent_sec: 210,
      exceeded_cutoff: true,
      confidence: "unsure" as const,
      pre_think: null,
      attempted_at: new Date().toISOString(),
    };
    const problem = makeProblem("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "quant");
    const micro = buildMicroQuickDraft(attempt, problem);
    const quick = buildQuickReportPayload({
      attempt,
      problem,
      microQuick: {
        ...micro,
        error_type: "time_panic",
        next_tool: "lock_condition",
      },
    });
    const deep = buildAutoDeepenPayload({
      report_id: "report-1",
      attempt,
      problem,
      quickReport: quick,
    });

    expect(quick.error_type).toBe("time_panic");
    expect(quick.next_tool).toContain("조건");
    expect(shouldAutoDeepenAttempt(attempt)).toBe(true);
    expect(mapAttemptToRecall(attempt)).toBe("no_recall");
    expect(deep.logic_comparison).toContain(quick.next_tool);
  });

  it("builds a concept support card from deepen output", () => {
    const card = buildConceptSupportCard(
      {
        report: {
          id: "report-1",
          attempt_id: "attempt-1",
          review_queue_id: null,
          report_mode: "deep",
          my_frame: "I rushed the stem.",
          correct_mechanism: "Compare the exact target first.",
          next_tool: "질문 재서술",
          mechanism_english: "Restate the target before evaluating choices.",
          logic_comparison: "The first frame chased wording, not the actual task.",
          sub_report: null,
          failure_stage: "strategy",
          error_type: "scope_drift",
          ai_wrong_choices: null,
          ai_core_principle: "Tie every choice back to the task.",
          ai_emotional_diary: null,
          ai_visual_concept: "질문을 한 줄로 다시 쓰고 선택지를 본다.",
          created_at: new Date().toISOString(),
          deepened_at: new Date().toISOString(),
        },
        ai_analysis: {
          wrong_choices: "You reacted to surface wording instead of the task.",
          core_principle: "Anchor to the task before testing choices.",
          emotional_diary: "Ignore the rush and restate the ask.",
          visual_concept: "선지 보기 전 질문을 다시 적는다.",
        },
      },
      {
        my_frame: "I rushed.",
        correct_mechanism: "Restate first.",
        next_tool: "질문 재서술",
        failure_stage: "strategy",
        error_type: "scope_drift",
        save_as_rule: false,
      },
    );

    expect(card?.mechanism).toContain("Anchor");
    expect(card?.frame_shift).toContain("surface wording");
    expect(card?.checkpoint).toContain("질문");
  });
});
