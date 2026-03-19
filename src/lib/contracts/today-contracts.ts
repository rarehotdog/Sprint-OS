import { z } from "zod";

import { problemSectionSchema } from "@/lib/contracts/problem-contracts";

const nonEmpty = z.string().trim().min(1);
const dateYmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const scoreSchema = z.number().int().min(1).max(5);

export const todayBlockTypeSchema = z.enum([
  "warmup_review",
  "main_block",
  "consolidation",
  "booklet_refresh",
]);

export const todayBlockStatusSchema = z.enum(["pending", "in_progress", "completed"]);

export const dailyCheckinSchema = z
  .object({
    id: z.string().uuid(),
    date: dateYmdSchema,
    energy: scoreSchema,
    focus: scoreSchema,
    stress: scoreSchema,
    sleep_quality: scoreSchema,
    confidence: scoreSchema,
    available_minutes: z.number().int().min(10).max(720),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

export const dailyPlanBlockSchema = z
  .object({
    id: z.string().uuid(),
    block_type: todayBlockTypeSchema,
    title: nonEmpty,
    minutes: z.number().int().min(10),
    status: todayBlockStatusSchema,
    target_ids: z.array(z.string().uuid()),
    section_hint: problemSectionSchema.nullable(),
    linked_session_id: z.string().uuid().nullable(),
    notes: nonEmpty.nullable(),
  })
  .strict();

export const dailyPlanSchema = z
  .object({
    id: z.string().uuid(),
    date: dateYmdSchema,
    generated_at: z.string().datetime(),
    source_counts: z
      .object({
        yesterday_weakness: z.number().int().nonnegative(),
        due_review: z.number().int().nonnegative(),
        weak_clusters: z.number().int().nonnegative(),
      })
      .strict(),
    blocks: z.array(dailyPlanBlockSchema).min(1),
  })
  .strict();

export const todayNextActionSchema = z
  .object({
    type: z.enum(["review", "solve", "consolidation", "booklet"]),
    label: nonEmpty,
    href: z.string().startsWith("/"),
  })
  .strict();

export const todayProgressSchema = z
  .object({
    total_blocks: z.number().int().nonnegative(),
    completed_blocks: z.number().int().nonnegative(),
    current_block_id: z.string().uuid().nullable(),
    completion_rate: z.number().min(0).max(1),
  })
  .strict();

export const todayBookletCandidateSchema = z
  .object({
    kind: z.enum(["concept", "mechanism", "trap", "tip", "flow"]),
    text: nonEmpty,
    source_report_id: z.string().uuid().nullable(),
    source_rule_id: z.string().uuid().nullable(),
  })
  .strict();

export const todayQueueItemSchema = z
  .object({
    id: z.string().uuid(),
    problem_id: z.string().uuid(),
    review_queue_id: z.string().uuid().nullable(),
    section: problemSectionSchema,
    sub_type: nonEmpty,
    source: z.enum(["due_review", "new"]),
    status: z.enum(["current", "pending", "completed"]),
    title: nonEmpty,
    due_at: z.string().datetime().nullable(),
  })
  .strict();

export const todayQueueCountsSchema = z
  .object({
    due_review: z.number().int().nonnegative(),
    new_problems: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    target_due_review: z.number().int().nonnegative(),
    target_new_problems: z.number().int().nonnegative(),
    estimated_minutes: z.number().int().nonnegative(),
    shortage: z.boolean(),
  })
  .strict();

export const todaySnapshotSchema = z
  .object({
    checkin: dailyCheckinSchema.nullable(),
    yesterday_weakness: z.array(
      z
        .object({
          section: problemSectionSchema,
          sub_type: nonEmpty,
          total: z.number().int().nonnegative(),
          incorrect: z.number().int().nonnegative(),
          accuracy: z.number().min(0).max(1),
        })
        .strict(),
    ),
    due_review: z.array(
      z
        .object({
          review_queue_id: z.string().uuid(),
          problem_id: z.string().uuid(),
          next_review_at: z.string().datetime(),
          priority_score: z.number().nonnegative(),
        })
        .strict(),
    ),
    plan: dailyPlanSchema.nullable(),
    progress: todayProgressSchema,
    booklet_candidates: z.array(todayBookletCandidateSchema),
    next_action: todayNextActionSchema.nullable(),
    resume_session_id: z.string().uuid().nullable(),
    today_queue: z.array(todayQueueItemSchema),
    focus_problem_id: z.string().uuid().nullable(),
    queue_counts: todayQueueCountsSchema,
  })
  .strict();

export const postTodayCheckinSchema = z
  .object({
    date: dateYmdSchema,
    energy: scoreSchema,
    focus: scoreSchema,
    stress: scoreSchema,
    sleep_quality: scoreSchema,
    confidence: scoreSchema,
    available_minutes: z.number().int().min(10).max(720),
  })
  .strict();

export const postTodayCheckinResponseSchema = z
  .object({
    checkin: dailyCheckinSchema,
  })
  .strict();

export const postTodayPlanSchema = z
  .object({
    date: dateYmdSchema,
    force_regenerate: z.boolean().optional().default(false),
  })
  .strict();

export const postTodayPlanResponseSchema = z
  .object({
    plan: dailyPlanSchema,
    source_counts: dailyPlanSchema.shape.source_counts,
    next_action: todayNextActionSchema,
  })
  .strict();

export const postTodayReplanSchema = z
  .object({
    date: dateYmdSchema,
    reason: nonEmpty,
    remaining_minutes: z.number().int().min(10).max(720).optional(),
  })
  .strict();

export const postTodayReplanResponseSchema = z
  .object({
    plan: dailyPlanSchema,
    changed_blocks: z.array(z.string().uuid()),
    next_action: todayNextActionSchema,
  })
  .strict();

export const postTodayProgressSchema = z
  .object({
    date: dateYmdSchema,
    block_id: z.string().uuid(),
    status: todayBlockStatusSchema,
  })
  .strict();

export const postTodayProgressResponseSchema = z
  .object({
    plan: dailyPlanSchema,
    changed_blocks: z.array(z.string().uuid()),
    next_action: todayNextActionSchema,
  })
  .strict();

export const postTodayStartSchema = z
  .object({
    date: dateYmdSchema,
    checkin: z
      .object({
        energy: scoreSchema,
        focus: scoreSchema,
        stress: scoreSchema,
        sleep_quality: scoreSchema,
        confidence: scoreSchema,
        available_minutes: z.number().int().min(10).max(720),
      })
      .strict(),
    force_regenerate: z.boolean().optional().default(false),
  })
  .strict();

export const postTodayStartResponseSchema = z
  .object({
    checkin: dailyCheckinSchema,
    plan: dailyPlanSchema,
    progress: todayProgressSchema,
    next_action: todayNextActionSchema,
    redirect_to: z.string().startsWith("/"),
    resume_session_id: z.string().uuid().nullable(),
    today_queue: z.array(todayQueueItemSchema),
    focus_problem_id: z.string().uuid().nullable(),
    queue_counts: todayQueueCountsSchema,
  })
  .strict();

export const todayQuerySchema = z
  .object({
    date: dateYmdSchema.optional(),
  })
  .strict();

export type DailyCheckinOutput = z.infer<typeof dailyCheckinSchema>;
export type DailyPlanOutput = z.infer<typeof dailyPlanSchema>;
export type TodaySnapshotOutput = z.infer<typeof todaySnapshotSchema>;
export type PostTodayCheckinInput = z.infer<typeof postTodayCheckinSchema>;
export type PostTodayPlanInput = z.infer<typeof postTodayPlanSchema>;
export type PostTodayReplanInput = z.infer<typeof postTodayReplanSchema>;
export type PostTodayProgressInput = z.infer<typeof postTodayProgressSchema>;
export type PostTodayStartInput = z.infer<typeof postTodayStartSchema>;
