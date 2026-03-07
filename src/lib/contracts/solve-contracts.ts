import { z } from "zod";

export const sessionTypeSchema = z.enum([
  "sprint_verbal",
  "sprint_quant",
  "sprint_di",
  "mock_full",
  "mock_section",
  "review",
  "drill",
]);

export const confidenceSchema = z.enum(["sure", "unsure", "guessed"]);

export const createSessionSchema = z.object({
  session_type: sessionTypeSchema,
  recipe: z.string().trim().nullable().optional().default(null),
  duration_planned_min: z.number().int().positive(),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

export const createAttemptSchema = z.object({
  problem_id: z.string().uuid(),
  session_id: z.string().uuid(),
  user_answer: z.number().int().nullable().optional().default(null),
  is_correct: z.boolean(),
  time_spent_sec: z.number().int().nonnegative(),
  exceeded_cutoff: z.boolean().optional().default(false),
  confidence: confidenceSchema.nullable().optional().default(null),
  pre_think: z.unknown().nullable().optional().default(null),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
