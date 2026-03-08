import { z } from "zod";

import { answerFlowSchema, summaryCardSchema } from "@/lib/contracts/knowledge-contracts";
import {
  errorSubReportSchema,
  failureStageSchema,
  reportModeSchema,
} from "@/lib/contracts/report-contracts";

const nonEmpty = z.string().trim().min(1);

const reportPreviewSchema = z
  .object({
    id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    review_queue_id: z.string().uuid().nullable(),
    report_mode: z.enum(["quick", "deep"]),
    my_frame: nonEmpty,
    correct_mechanism: nonEmpty,
    next_tool: nonEmpty,
    error_type: z.string().trim().nullable(),
    created_at: z.string().datetime(),
    deepened_at: z.string().datetime().nullable(),
  })
  .strict();

const reviewInboxCountsSchema = z
  .object({
    total_reports: z.number().int().nonnegative(),
    pending_deep: z.number().int().nonnegative(),
    due_self_test: z.number().int().nonnegative(),
    recent_deep: z.number().int().nonnegative(),
    answer_flows: z.number().int().nonnegative(),
  })
  .strict();

const reviewInboxDueSelfTestItemSchema = z
  .object({
    review_queue_id: z.string().uuid(),
    next_review_at: z.string().datetime(),
    priority_score: z.number().nonnegative(),
    report: reportPreviewSchema,
  })
  .strict();

const reviewInboxAnswerFlowSchema = z
  .object({
    id: z.string().uuid(),
    ask: nonEmpty,
    key_factor: nonEmpty,
    mechanism: nonEmpty,
    check: nonEmpty,
    source_report_id: z.string().uuid().nullable(),
    created_at: z.string().datetime(),
  })
  .strict();

const reviewInboxActionSchema = z
  .object({
    type: z.enum(["deepen", "self_test", "summary"]),
    label: nonEmpty,
    href: z.string().startsWith("/"),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const reviewInboxResponseSchema = z
  .object({
    counts: reviewInboxCountsSchema,
    pending_deep: z.array(reportPreviewSchema),
    due_self_test: z.array(reviewInboxDueSelfTestItemSchema),
    recent_deep: z.array(reportPreviewSchema),
    answer_flows: z.array(reviewInboxAnswerFlowSchema),
    next_actions: z.array(reviewInboxActionSchema),
  })
  .strict();

export const reviewReportsQuerySchema = z
  .object({
    report_id: z.string().uuid().optional(),
    mode: reportModeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const errorReportSchema = z
  .object({
    id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    review_queue_id: z.string().uuid().nullable(),
    report_mode: reportModeSchema,
    my_frame: nonEmpty,
    correct_mechanism: nonEmpty,
    next_tool: nonEmpty,
    mechanism_english: z.string().trim().nullable(),
    logic_comparison: z.string().trim().nullable(),
    sub_report: errorSubReportSchema.nullable(),
    failure_stage: failureStageSchema.nullable(),
    error_type: z.string().trim().nullable(),
    ai_wrong_choices: z.string().trim().nullable(),
    ai_core_principle: z.string().trim().nullable(),
    ai_emotional_diary: z.string().trim().nullable(),
    ai_visual_concept: z.string().trim().nullable(),
    created_at: z.string().datetime(),
    deepened_at: z.string().datetime().nullable(),
  })
  .strict();

export const reviewReportQueueStateSchema = z
  .object({
    review_queue_id: z.string().uuid(),
    next_review_at: z.string().datetime(),
    interval_days: z.number().int().nonnegative(),
    repetitions: z.number().int().nonnegative(),
    priority_score: z.number().nonnegative(),
  })
  .strict();

export const reviewSelectedReportDetailSchema = z
  .object({
    report: errorReportSchema.nullable(),
    answer_flow: answerFlowSchema.nullable(),
    summary_cards: z.array(summaryCardSchema),
    review_queue: reviewReportQueueStateSchema.nullable(),
  })
  .strict();

export const reviewReportsResponseSchema = z
  .object({
    inbox: reviewInboxResponseSchema,
    reports: z.array(reportPreviewSchema),
    selected_report: reviewSelectedReportDetailSchema,
    filters_applied: z
      .object({
        mode: reportModeSchema.nullable(),
        report_id: z.string().uuid().nullable(),
        limit: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
