import { addDays } from "date-fns";

import type { Sm2RecallInput, Sm2UpdateOutput } from "@/lib/contracts/report-contracts";

interface Sm2State {
  review_queue_id: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
}

const QUALITY_BY_RECALL: Record<Sm2RecallInput, number> = {
  complete_recall: 5,
  uncertain: 3,
  no_recall: 1,
};

function clampEaseFactor(value: number): number {
  return Math.max(1.3, Number(value.toFixed(2)));
}

function mapPriorityScore(recall: Sm2RecallInput, intervalDays: number): number {
  const recallWeight =
    recall === "no_recall" ? 1 : recall === "uncertain" ? 0.5 : 0.15;

  const spacingWeight = Number((1 / Math.max(intervalDays, 1)).toFixed(4));
  return Number((recallWeight + spacingWeight).toFixed(4));
}

export function computeSm2Update(
  current: Sm2State,
  recall: Sm2RecallInput,
  reviewedAt?: string,
): Sm2UpdateOutput {
  const quality = QUALITY_BY_RECALL[recall];

  let repetitions = current.repetitions;
  let intervalDays = current.interval_days;
  let easeFactor = current.ease_factor;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
    repetitions += 1;
  }

  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor = clampEaseFactor(easeFactor + efDelta);

  const reviewBase = reviewedAt ? new Date(reviewedAt) : new Date();
  const nextReviewAt = addDays(reviewBase, intervalDays).toISOString();

  return {
    review_queue_id: current.review_queue_id,
    next_review_at: nextReviewAt,
    interval_days: intervalDays,
    ease_factor: easeFactor,
    repetitions,
    priority_score: mapPriorityScore(recall, intervalDays),
  };
}
