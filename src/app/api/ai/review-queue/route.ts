import { NextResponse } from "next/server";

import {
  sm2UpdateRequestSchema,
  sm2UpdateResponseSchema,
} from "@/lib/contracts/report-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import { computeSm2Update } from "@/lib/server/sm2";

export async function GET() {
  const repositories = await getServerRepositories();
  return NextResponse.json({ queue: await repositories.reviewQueue.listQueue() });
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = sm2UpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid review-queue payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const item = await repositories.reviewQueue.getById(parsed.data.review_queue_id);
  if (!item) {
    return NextResponse.json({ error: "Review queue item not found" }, { status: 404 });
  }

  const updated = computeSm2Update(
    {
      review_queue_id: item.id,
      interval_days: item.interval_days,
      ease_factor: item.ease_factor,
      repetitions: item.repetitions,
    },
    parsed.data.recall,
    parsed.data.reviewed_at,
  );

  await repositories.reviewQueue.upsert({
    ...item,
    next_review_at: updated.next_review_at,
    interval_days: updated.interval_days,
    ease_factor: updated.ease_factor,
    repetitions: updated.repetitions,
    priority_score: updated.priority_score,
  });

  return NextResponse.json(sm2UpdateResponseSchema.parse(updated));
}
