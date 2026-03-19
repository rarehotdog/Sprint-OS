import { describe, expect, it } from "vitest";

import {
  DEFAULT_TODAY_START_CHECKIN,
  getCurrentPlanBlock,
  getCurrentSolveSection,
  getLatestLinkedSolveReviewHref,
  getPlannedSolveSection,
  getTodayQueueFocusLine,
  getTodayQueuePrimaryAction,
  getSolveGuardState,
  getTodayPrimaryAction,
  getTodayStartCheckin,
  getTodayTopTaskCards,
  getWarmupPracticeCards,
} from "../src/lib/today-ui";
import type { DailyCheckin, DailyPlan, TodayNextAction } from "../src/lib/types";

function makePlan(): DailyPlan {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    date: "2026-03-17",
    generated_at: new Date().toISOString(),
    source_counts: {
      yesterday_weakness: 1,
      due_review: 0,
      weak_clusters: 1,
    },
    blocks: [
      {
        id: "aaaa",
        block_type: "warmup_review",
        title: "Warmup",
        minutes: 20,
        status: "completed",
        target_ids: [],
        section_hint: null,
        linked_session_id: null,
        notes: null,
      },
      {
        id: "bbbb",
        block_type: "main_block",
        title: "Main",
        minutes: 60,
        status: "in_progress",
        target_ids: [],
        section_hint: "quant",
        linked_session_id: null,
        notes: null,
      },
      {
        id: "cccc",
        block_type: "consolidation",
        title: "Consolidate",
        minutes: 20,
        status: "pending",
        target_ids: [],
        section_hint: null,
        linked_session_id: null,
        notes: null,
      },
    ],
  };
}

describe("today ui helpers", () => {
  it("builds preview top tasks before a plan exists", () => {
    const cards = getTodayTopTaskCards(null);

    expect(cards).toHaveLength(3);
    expect(cards[0]?.title).toBe("Warmup Review");
    expect(cards[0]?.is_current).toBe(true);
    expect(cards[2]?.title).toBe("Consolidation");
  });

  it("shows the current block and next two blocks in the top task rail", () => {
    const cards = getTodayTopTaskCards({
      ...makePlan(),
      blocks: [
        ...makePlan().blocks,
        {
          id: "dddd",
          block_type: "booklet_refresh",
          title: "Booklet",
          minutes: 10,
          status: "pending",
          target_ids: [],
          section_hint: null,
          linked_session_id: null,
          notes: null,
        },
      ],
    });

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.id)).toEqual(["bbbb", "cccc", "dddd"]);
    expect(cards[0]?.is_current).toBe(true);
  });

  it("keeps the last visible tasks when the plan is already completed", () => {
    const cards = getTodayTopTaskCards({
      ...makePlan(),
      blocks: makePlan().blocks.map((block) => ({
        ...block,
        status: "completed" as const,
      })),
    });

    expect(cards).toHaveLength(3);
    expect(cards[2]?.is_current).toBe(true);
    expect(cards[2]?.status).toBe("completed");
  });

  it("selects the current in-progress block before later pending blocks", () => {
    const current = getCurrentPlanBlock(makePlan());

    expect(current?.id).toBe("bbbb");
    expect(current?.block_type).toBe("main_block");
  });

  it("finds the next planned solve section even during warmup", () => {
    const plan = makePlan();
    plan.blocks[0]!.status = "in_progress";
    plan.blocks[1]!.status = "pending";

    expect(getPlannedSolveSection(plan)).toBe("quant");
  });

  it("derives solve section from the active main block", () => {
    const nextAction: TodayNextAction = {
      type: "solve",
      label: "메인 문제 풀이 시작",
      href: "/solve",
    };

    expect(getCurrentSolveSection({ plan: makePlan(), next_action: nextAction })).toBe("quant");
  });

  it("blocks solve CTA when the target section has no problems", () => {
    const guard = getSolveGuardState("quant", 0);

    expect(guard.blocked).toBe(true);
    expect(guard.problemsHref).toBe("/problems?section=quant");
    expect(guard.message).toContain("quant");
  });

  it("uses inline warmup mode when review has no actionable content", () => {
    const action = getTodayPrimaryAction({
      hasStartedToday: true,
      currentBlock: {
        ...makePlan().blocks[0]!,
        status: "in_progress",
      },
      nextAction: {
        type: "review",
        label: "Due review 먼저 처리",
        href: "/review/reports",
      },
      solveBlocked: false,
      solveProblemsHref: "/problems?section=quant",
      reviewHasContent: false,
      consolidationReviewHref: null,
    });

    expect(action.kind).toBe("warmup_inline");
    expect(action.label).toContain("Warmup");
  });

  it("routes review action to the review reports page when content exists", () => {
    const action = getTodayPrimaryAction({
      hasStartedToday: true,
      currentBlock: {
        ...makePlan().blocks[0]!,
        status: "in_progress",
      },
      nextAction: {
        type: "review",
        label: "Due review 먼저 처리",
        href: "/review/reports",
      },
      solveBlocked: false,
      solveProblemsHref: "/problems?section=quant",
      reviewHasContent: true,
      consolidationReviewHref: null,
    });

    expect(action.kind).toBe("review_route");
    expect(action.href).toBe("/review/reports");
  });

  it("routes consolidation to the latest linked solve review page", () => {
    const plan = makePlan();
    plan.blocks[1]!.linked_session_id = "22222222-2222-2222-2222-222222222222";
    plan.blocks[1]!.status = "completed";
    plan.blocks[2]!.status = "in_progress";

    expect(getLatestLinkedSolveReviewHref(plan)).toBe(
      "/solve/22222222-2222-2222-2222-222222222222/review",
    );

    const action = getTodayPrimaryAction({
      hasStartedToday: true,
      currentBlock: plan.blocks[2]!,
      nextAction: {
        type: "consolidation",
        label: "Deep 확장/복기 진행",
        href: "/review/deepen",
      },
      solveBlocked: false,
      solveProblemsHref: "/problems",
      reviewHasContent: false,
      consolidationReviewHref: getLatestLinkedSolveReviewHref(plan),
    });

    expect(action.kind).toBe("consolidation_route");
    expect(action.href).toContain("/solve/22222222-2222-2222-2222-222222222222/review");
  });

  it("builds weakness-based warmup practice cards first", () => {
    const cards = getWarmupPracticeCards({
      yesterdayWeakness: [
        {
          section: "verbal",
          sub_type: "cr_strengthen",
          total: 4,
          incorrect: 3,
          accuracy: 0.25,
        },
      ],
      fallbackSection: "quant",
    });

    expect(cards[0]?.title).toContain("cr_strengthen");
    expect(cards[0]?.source).toBe("yesterday weakness");
  });

  it("falls back to the next solve section for warmup practice when weakness is empty", () => {
    const cards = getWarmupPracticeCards({
      yesterdayWeakness: [],
      fallbackSection: "di",
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toContain("DI");
    expect(cards[0]?.source).toBe("next main solve");
  });

  it("reuses the last checkin when building the hidden start payload", () => {
    const existing: DailyCheckin = {
      id: "checkin-1",
      date: "2026-03-18",
      energy: 5,
      focus: 4,
      stress: 2,
      sleep_quality: 4,
      confidence: 5,
      available_minutes: 90,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(getTodayStartCheckin(existing)).toEqual({
      energy: 5,
      focus: 4,
      stress: 2,
      sleep_quality: 4,
      confidence: 5,
      available_minutes: 90,
    });
  });

  it("falls back to the default hidden start payload when no checkin exists", () => {
    expect(getTodayStartCheckin(null)).toEqual(DEFAULT_TODAY_START_CHECKIN);
  });

  it("builds a resume CTA when a queue session already exists", () => {
    const action = getTodayQueuePrimaryAction({
      resumeSessionId: "22222222-2222-2222-2222-222222222222",
      focusProblemId: "33333333-3333-3333-3333-333333333333",
      queueCounts: {
        due_review: 2,
        new_problems: 5,
        completed: 1,
        total: 8,
        target_due_review: 2,
        target_new_problems: 5,
        estimated_minutes: 46,
        shortage: false,
      },
      problemsHref: "/problems?section=quant",
    });

    expect(action.kind).toBe("resume");
    expect(action.href).toBe("/solve/22222222-2222-2222-2222-222222222222");
  });

  it("builds a shortage focus line from queue counts", () => {
    const line = getTodayQueueFocusLine({
      due_review: 0,
      new_problems: 4,
      completed: 0,
      total: 4,
      target_due_review: 2,
      target_new_problems: 5,
      estimated_minutes: 32,
      shortage: true,
    });

    expect(line).toContain("새 문제 4개");
  });
});
