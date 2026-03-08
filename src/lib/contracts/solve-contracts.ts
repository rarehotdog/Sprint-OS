import { z } from "zod";

import { problemSectionSchema } from "@/lib/contracts/problem-contracts";

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
  problem_ids: z.array(z.string().uuid()).optional().default([]),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

export const completeSessionSchema = z.object({
  session_id: z.string().uuid(),
  completed_at: z.string().datetime().optional(),
  duration_actual_min: z.number().int().positive().optional(),
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

export const sessionEntitySchema = z
  .object({
    id: z.string().uuid(),
    session_type: sessionTypeSchema,
    recipe: z.string().trim().nullable(),
    duration_planned_min: z.number().int().positive(),
    duration_actual_min: z.number().int().positive().nullable(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().nullable(),
    meta: z.record(z.string(), z.unknown()),
  })
  .strict();

export const sessionRunStateSchema = z
  .object({
    session_id: z.string().uuid(),
    ordered_problem_ids: z.array(z.string().uuid()),
    attempted_problem_ids: z.array(z.string().uuid()),
    attempted_count: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative(),
    current_index: z.number().int().nonnegative(),
    next_problem_id: z.string().uuid().nullable(),
    completed: z.boolean(),
  })
  .strict();

export const sessionSectionBoundSchema = z
  .object({
    section: problemSectionSchema,
    start_index: z.number().int().nonnegative(),
    end_index: z.number().int().nonnegative(),
  })
  .strict();

export const sessionSolveContextSchema = z
  .object({
    section_hint: problemSectionSchema.nullable(),
    duration_planned_min: z.number().int().positive(),
    section_order: z.array(problemSectionSchema),
    section_bounds: z.array(sessionSectionBoundSchema),
  })
  .strict();

export const sessionDetailResponseSchema = z
  .object({
    session: sessionEntitySchema,
    run_state: sessionRunStateSchema,
    solve_context: sessionSolveContextSchema,
  })
  .strict();

export type CreateSessionInput = z.input<typeof createSessionSchema>;
export type CompleteSessionInput = z.input<typeof completeSessionSchema>;
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
