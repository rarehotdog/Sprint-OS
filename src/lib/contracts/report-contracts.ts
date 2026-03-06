import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const sectionSchema = z.enum(["verbal", "quant", "di"]);

export const failureStageSchema = z.enum([
  "reading",
  "strategy",
  "calculation",
  "verification",
  "time_pressure",
]);

export const reportModeSchema = z.enum(["quick", "deep"]);

export const crSubReportSchema = z.object({
  conclusion_restated: nonEmptyText,
  gap_identified: nonEmptyText,
  which_choice_attacked_c: nonEmptyText,
});

export const rcSubReportSchema = z.object({
  paragraph_function_error: nonEmptyText,
  index_paraphrase_check: nonEmptyText,
});

export const dsSubReportSchema = z.object({
  question_reframed_as: nonEmptyText,
  sufficiency_pivot: nonEmptyText,
});

export const qrPercentSubReportSchema = z.object({
  base_value_identified: nonEmptyText,
  relationship_type: z.enum(["ratio", "multiple", "distance"]),
});

export const errorSubReportSchema = z
  .object({
    cr: crSubReportSchema.optional(),
    rc: rcSubReportSchema.optional(),
    ds: dsSubReportSchema.optional(),
    qr_percent: qrPercentSubReportSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one sub-report payload is required",
  });

export const createQuickReportSchema = z.object({
  attempt_id: z.string().uuid(),
  report_mode: z.literal("quick").optional().default("quick"),
  my_frame: nonEmptyText,
  correct_mechanism: nonEmptyText,
  next_tool: nonEmptyText,
  failure_stage: failureStageSchema,
  error_type: nonEmptyText,
  save_as_rule: z.boolean().optional().default(false),
});

export const deepenReportSchema = z.object({
  report_id: z.string().uuid(),
  mechanism_english: nonEmptyText,
  logic_comparison: nonEmptyText,
  sub_report: errorSubReportSchema.nullable().optional(),
  generate_ai: z.boolean().optional().default(true),
});

export const analyzeReportRequestSchema = z.object({
  problem_content: z.record(z.string(), z.unknown()).optional(),
  user_answer: z.number().int().nullable().optional(),
  pre_think: z.unknown().nullable().optional(),
  my_frame: nonEmptyText,
  correct_mechanism: nonEmptyText,
  next_tool: nonEmptyText,
  mechanism_english: z.string().trim().nullable().optional(),
  logic_comparison: z.string().trim().nullable().optional(),
  sub_report: errorSubReportSchema.nullable().optional(),
});

export const analyzeReportResponseSchema = z
  .object({
    wrong_choices: nonEmptyText,
    core_principle: nonEmptyText,
    emotional_diary: nonEmptyText,
    visual_concept: nonEmptyText,
  })
  .strict();

export const sm2RecallSchema = z.enum([
  "complete_recall",
  "uncertain",
  "no_recall",
]);

export const sm2UpdateRequestSchema = z.object({
  review_queue_id: z.string().uuid(),
  recall: sm2RecallSchema,
  reviewed_at: z.string().datetime().optional(),
});

export const sm2UpdateResponseSchema = z
  .object({
    review_queue_id: z.string().uuid(),
    next_review_at: z.string().datetime(),
    interval_days: z.number().int().nonnegative(),
    ease_factor: z.number(),
    repetitions: z.number().int().nonnegative(),
    priority_score: z.number().nonnegative(),
  })
  .strict();

export type CreateQuickReportInput = z.infer<typeof createQuickReportSchema>;
export type DeepenReportInput = z.infer<typeof deepenReportSchema>;
export type AnalyzeReportInput = z.infer<typeof analyzeReportRequestSchema>;
export type AnalyzeReportOutput = z.infer<typeof analyzeReportResponseSchema>;
export type Sm2RecallInput = z.infer<typeof sm2RecallSchema>;
export type Sm2UpdateInput = z.infer<typeof sm2UpdateRequestSchema>;
export type Sm2UpdateOutput = z.infer<typeof sm2UpdateResponseSchema>;
