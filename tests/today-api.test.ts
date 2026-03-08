import { beforeEach, describe, expect, it } from "vitest";

import { GET as getToday } from "../src/app/api/today/route";
import { POST as postTodayCheckin } from "../src/app/api/today/checkin/route";
import { POST as postTodayPlan } from "../src/app/api/today/plan/route";
import { POST as postTodayProgress } from "../src/app/api/today/progress/route";
import { POST as postTodayReplan } from "../src/app/api/today/replan/route";
import { POST as postTodayStart } from "../src/app/api/today/start/route";
import { resetReportStoreForTests } from "../src/lib/server/report-store";
import { resetQueueStoreForTests } from "../src/lib/server/review-queue-store";
import { resetSolveStoreForTests } from "../src/lib/server/solve-store";
import { resetTodayStoreForTests } from "../src/lib/server/today-store";

function postRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetTodayStoreForTests();
  resetReportStoreForTests();
  resetQueueStoreForTests();
  resetSolveStoreForTests();
});

describe("today api", () => {
  it("rejects invalid today checkin payload", async () => {
    const response = await postTodayCheckin(
      postRequest("http://localhost/api/today/checkin", {
        date: "2026-03-08",
        energy: 10,
        focus: 3,
        stress: 3,
        sleep_quality: 3,
        confidence: 3,
        available_minutes: 120,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("persists checkin and returns it from GET /api/today", async () => {
    const date = "2026-03-08";

    const checkin = await postTodayCheckin(
      postRequest("http://localhost/api/today/checkin", {
        date,
        energy: 4,
        focus: 3,
        stress: 2,
        sleep_quality: 4,
        confidence: 3,
        available_minutes: 90,
      }),
    );

    expect(checkin.status).toBe(200);

    const snapshot = await getToday(new Request(`http://localhost/api/today?date=${date}`));
    expect(snapshot.status).toBe(200);

    const payload = (await snapshot.json()) as {
      checkin: { date: string; energy: number; available_minutes: number } | null;
    };

    expect(payload.checkin?.date).toBe(date);
    expect(payload.checkin?.energy).toBe(4);
    expect(payload.checkin?.available_minutes).toBe(90);
  });

  it("generates review-first daily plan blocks", async () => {
    const date = "2026-03-08";

    await postTodayCheckin(
      postRequest("http://localhost/api/today/checkin", {
        date,
        energy: 3,
        focus: 3,
        stress: 3,
        sleep_quality: 3,
        confidence: 3,
        available_minutes: 120,
      }),
    );

    const response = await postTodayPlan(
      postRequest("http://localhost/api/today/plan", {
        date,
        force_regenerate: true,
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      plan: { blocks: Array<{ block_type: string; minutes: number }> };
      source_counts: { yesterday_weakness: number; due_review: number; weak_clusters: number };
      next_action: { type: string; href: string };
    };

    expect(payload.plan.blocks[0]?.block_type).toBe("warmup_review");
    expect(payload.plan.blocks[0]?.minutes).toBeGreaterThanOrEqual(10);
    expect(payload.source_counts.yesterday_weakness).toBeGreaterThanOrEqual(0);
    expect(payload.source_counts.due_review).toBeGreaterThanOrEqual(0);
    expect(payload.source_counts.weak_clusters).toBeGreaterThanOrEqual(0);
    expect(payload.next_action.type).toBe("review");
    expect(payload.next_action.href).toBe("/review/reports");
  });

  it("replans and returns changed blocks with consistent next_action", async () => {
    const date = "2026-03-08";

    await postTodayCheckin(
      postRequest("http://localhost/api/today/checkin", {
        date,
        energy: 2,
        focus: 2,
        stress: 4,
        sleep_quality: 2,
        confidence: 2,
        available_minutes: 80,
      }),
    );

    await postTodayPlan(
      postRequest("http://localhost/api/today/plan", {
        date,
        force_regenerate: true,
      }),
    );

    const replanned = await postTodayReplan(
      postRequest("http://localhost/api/today/replan", {
        date,
        reason: "pace_adjustment",
        remaining_minutes: 60,
      }),
    );

    expect(replanned.status).toBe(200);

    const payload = (await replanned.json()) as {
      changed_blocks: string[];
      plan: { blocks: Array<{ id: string }> };
      next_action: { type: string; href: string };
    };

    expect(payload.changed_blocks.length).toBeGreaterThan(0);
    expect(payload.changed_blocks.every((id) => payload.plan.blocks.some((b) => b.id === id))).toBe(
      true,
    );
    expect(payload.next_action.type).toBeTruthy();
    expect(payload.next_action.href.startsWith("/")).toBe(true);
  });

  it("updates block progress and advances next block", async () => {
    const date = "2026-03-08";

    await postTodayCheckin(
      postRequest("http://localhost/api/today/checkin", {
        date,
        energy: 3,
        focus: 3,
        stress: 3,
        sleep_quality: 3,
        confidence: 3,
        available_minutes: 120,
      }),
    );

    const planned = await postTodayPlan(
      postRequest("http://localhost/api/today/plan", {
        date,
        force_regenerate: true,
      }),
    );
    const plannedPayload = (await planned.json()) as {
      plan: { blocks: Array<{ id: string; status: string }> };
    };

    const firstBlock = plannedPayload.plan.blocks[0];
    expect(firstBlock).toBeTruthy();

    const progressed = await postTodayProgress(
      postRequest("http://localhost/api/today/progress", {
        date,
        block_id: firstBlock?.id,
        status: "completed",
      }),
    );

    expect(progressed.status).toBe(200);
    const payload = (await progressed.json()) as {
      changed_blocks: string[];
      plan: { blocks: Array<{ id: string; status: string }> };
      next_action: { type: string };
    };

    expect(payload.changed_blocks.length).toBeGreaterThan(0);
    const refreshedFirst = payload.plan.blocks.find((block) => block.id === firstBlock?.id);
    expect(refreshedFirst?.status).toBe("completed");
    expect(payload.plan.blocks.some((block) => block.status === "in_progress")).toBe(true);
    expect(payload.next_action.type).toBe("solve");
  });

  it("forces booklet next_action when all blocks are completed", async () => {
    const date = "2026-03-08";

    await postTodayCheckin(
      postRequest("http://localhost/api/today/checkin", {
        date,
        energy: 3,
        focus: 3,
        stress: 3,
        sleep_quality: 3,
        confidence: 3,
        available_minutes: 120,
      }),
    );

    const planned = await postTodayPlan(
      postRequest("http://localhost/api/today/plan", {
        date,
        force_regenerate: true,
      }),
    );
    const plannedPayload = (await planned.json()) as {
      plan: { blocks: Array<{ id: string }> };
    };

    let finalPayload: {
      next_action: { type: string; href: string };
      plan: { blocks: Array<{ status: string }> };
    } | null = null;

    for (const block of plannedPayload.plan.blocks) {
      const progressed = await postTodayProgress(
        postRequest("http://localhost/api/today/progress", {
          date,
          block_id: block.id,
          status: "completed",
        }),
      );
      expect(progressed.status).toBe(200);
      finalPayload = (await progressed.json()) as {
        next_action: { type: string; href: string };
        plan: { blocks: Array<{ status: string }> };
      };
    }

    expect(finalPayload).toBeTruthy();
    expect(finalPayload?.plan.blocks.every((block) => block.status === "completed")).toBe(true);
    expect(finalPayload?.next_action.type).toBe("booklet");
    expect(finalPayload?.next_action.href).toBe("/summary");
  });

  it("rejects invalid today start payload", async () => {
    const response = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date: "2026-03-08",
        checkin: {
          energy: 9,
          focus: 3,
          stress: 3,
          sleep_quality: 3,
          confidence: 3,
          available_minutes: 120,
        },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("starts loop with checkin/plan and returns redirect", async () => {
    const date = "2026-03-08";

    const started = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date,
        checkin: {
          energy: 4,
          focus: 4,
          stress: 2,
          sleep_quality: 4,
          confidence: 4,
          available_minutes: 100,
        },
      }),
    );
    expect(started.status).toBe(200);

    const payload = (await started.json()) as {
      checkin: { id: string; date: string };
      plan: { id: string; blocks: Array<{ status: string }> };
      next_action: { href: string; type: string };
      redirect_to: string;
    };
    expect(payload.checkin.date).toBe(date);
    expect(payload.plan.blocks.length).toBeGreaterThan(0);
    expect(payload.redirect_to).toBe(payload.next_action.href);
    expect(payload.next_action.type).toBeTruthy();

    const startedAgain = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date,
        checkin: {
          energy: 4,
          focus: 4,
          stress: 2,
          sleep_quality: 4,
          confidence: 4,
          available_minutes: 100,
        },
      }),
    );
    expect(startedAgain.status).toBe(200);
    const secondPayload = (await startedAgain.json()) as {
      checkin: { id: string };
      plan: { id: string };
      redirect_to: string;
    };
    expect(secondPayload.checkin.id).toBe(payload.checkin.id);
    expect(secondPayload.plan.id).toBe(payload.plan.id);
    expect(secondPayload.redirect_to.startsWith("/")).toBe(true);
  });

  it("forces /summary redirect when all blocks already completed", async () => {
    const date = "2026-03-08";

    const started = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date,
        checkin: {
          energy: 3,
          focus: 3,
          stress: 3,
          sleep_quality: 3,
          confidence: 3,
          available_minutes: 100,
        },
      }),
    );
    const startedPayload = (await started.json()) as {
      plan: { blocks: Array<{ id: string }> };
    };

    for (const block of startedPayload.plan.blocks) {
      await postTodayProgress(
        postRequest("http://localhost/api/today/progress", {
          date,
          block_id: block.id,
          status: "completed",
        }),
      );
    }

    const startedAgain = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date,
        checkin: {
          energy: 3,
          focus: 3,
          stress: 3,
          sleep_quality: 3,
          confidence: 3,
          available_minutes: 100,
        },
      }),
    );
    expect(startedAgain.status).toBe(200);
    const payload = (await startedAgain.json()) as {
      next_action: { type: string; href: string };
      redirect_to: string;
      plan: { blocks: Array<{ status: string }> };
    };
    expect(payload.plan.blocks.every((block) => block.status === "completed")).toBe(true);
    expect(payload.next_action.type).toBe("booklet");
    expect(payload.redirect_to).toBe("/summary");
  });

  it("auto-creates a solve session when current block is main_block", async () => {
    const date = "2026-03-08";

    const started = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date,
        checkin: {
          energy: 3,
          focus: 3,
          stress: 3,
          sleep_quality: 3,
          confidence: 3,
          available_minutes: 100,
        },
      }),
    );
    expect(started.status).toBe(200);
    const startedPayload = (await started.json()) as {
      plan: { blocks: Array<{ id: string; block_type: string }> };
      redirect_to: string;
    };
    expect(startedPayload.redirect_to).toBe("/review/reports");

    const warmup = startedPayload.plan.blocks.find((block) => block.block_type === "warmup_review");
    expect(warmup).toBeTruthy();

    const progressed = await postTodayProgress(
      postRequest("http://localhost/api/today/progress", {
        date,
        block_id: warmup?.id,
        status: "completed",
      }),
    );
    expect(progressed.status).toBe(200);

    const startedAgain = await postTodayStart(
      postRequest("http://localhost/api/today/start", {
        date,
        checkin: {
          energy: 3,
          focus: 3,
          stress: 3,
          sleep_quality: 3,
          confidence: 3,
          available_minutes: 100,
        },
      }),
    );
    expect(startedAgain.status).toBe(200);
    const payload = (await startedAgain.json()) as {
      plan: { blocks: Array<{ block_type: string; linked_session_id: string | null }> };
      next_action: { type: string };
      redirect_to: string;
    };

    expect(payload.next_action.type).toBe("solve");
    expect(payload.redirect_to).toMatch(/^\/solve\/[0-9a-fA-F-]{36}\?section=(verbal|quant|di)&duration=\d+$/);
    const mainBlock = payload.plan.blocks.find((block) => block.block_type === "main_block");
    expect(mainBlock?.linked_session_id).toBeTruthy();
  });
});
