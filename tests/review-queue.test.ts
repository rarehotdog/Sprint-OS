import { describe, expect, it } from "vitest";

import { sm2UpdateResponseSchema } from "../src/lib/contracts/report-contracts";
import { POST } from "../src/app/api/ai/review-queue/route";
import {
  resetQueueStoreForTests,
  seedQueueItem,
} from "../src/lib/server/review-queue-store";
import { computeSm2Update } from "../src/lib/server/sm2";

describe("SM-2 utility", () => {
  it("resets spacing when recall fails", () => {
    const updated = computeSm2Update(
      {
        review_queue_id: crypto.randomUUID(),
        interval_days: 6,
        ease_factor: 2.5,
        repetitions: 3,
      },
      "no_recall",
      "2026-03-06T00:00:00.000Z",
    );

    expect(updated.interval_days).toBe(1);
    expect(updated.repetitions).toBe(0);
    expect(updated.ease_factor).toBeGreaterThanOrEqual(1.3);
  });

  it("expands spacing for successful recall", () => {
    const updated = computeSm2Update(
      {
        review_queue_id: crypto.randomUUID(),
        interval_days: 1,
        ease_factor: 2.5,
        repetitions: 1,
      },
      "complete_recall",
      "2026-03-06T00:00:00.000Z",
    );

    expect(updated.interval_days).toBe(6);
    expect(updated.repetitions).toBe(2);
  });
});

describe("review queue API", () => {
  it("returns 404 when queue item is missing", async () => {
    resetQueueStoreForTests();

    const request = new Request("http://localhost/api/ai/review-queue", {
      method: "POST",
      body: JSON.stringify({
        review_queue_id: crypto.randomUUID(),
        recall: "uncertain",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("updates queue item with strict response contract", async () => {
    resetQueueStoreForTests();

    const queueId = crypto.randomUUID();
    seedQueueItem({
      id: queueId,
      problem_id: crypto.randomUUID(),
      next_review_at: "2026-03-06T00:00:00.000Z",
      interval_days: 1,
      ease_factor: 2.5,
      repetitions: 1,
      priority_score: 0.5,
      created_at: "2026-03-06T00:00:00.000Z",
    });

    const request = new Request("http://localhost/api/ai/review-queue", {
      method: "POST",
      body: JSON.stringify({
        review_queue_id: queueId,
        recall: "complete_recall",
        reviewed_at: "2026-03-06T00:00:00.000Z",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const parsed = sm2UpdateResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected valid response schema");
    }

    expect(parsed.data.review_queue_id).toBe(queueId);
    expect(parsed.data.interval_days).toBe(6);
    expect(parsed.data.repetitions).toBe(2);
  });
});
