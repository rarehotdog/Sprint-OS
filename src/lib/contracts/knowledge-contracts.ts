import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const knowledgeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const answerFlowSchema = z
  .object({
    id: z.string().uuid(),
    attempt_id: z.string().uuid().nullable(),
    report_id: z.string().uuid().nullable(),
    ask: nonEmpty,
    key_factor: nonEmpty,
    mechanism: nonEmpty,
    check: nonEmpty,
    created_at: z.string().datetime(),
  })
  .strict();

export const listAnswerFlowsResponseSchema = z
  .object({
    items: z.array(answerFlowSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const summaryCardSchema = z
  .object({
    id: z.string().uuid(),
    card_type: z.enum(["concept", "mechanism", "trap", "tip", "flow"]),
    content: nonEmpty,
    inclusion_score: z.number().min(0).max(1),
    source_report_id: z.string().uuid().nullable(),
    source_rule_id: z.string().uuid().nullable(),
  })
  .strict();

export const listSummaryCardsResponseSchema = z
  .object({
    items: z.array(summaryCardSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();

export type KnowledgeQueryInput = z.infer<typeof knowledgeQuerySchema>;
