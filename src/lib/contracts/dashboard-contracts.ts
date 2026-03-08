import { z } from "zod";

import { problemSectionSchema } from "@/lib/contracts/problem-contracts";

const nonEmpty = z.string().trim().min(1);

export const weaknessQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
  section: problemSectionSchema.optional(),
  source: nonEmpty.optional(),
});

export const weaknessDashboardResponseSchema = z
  .object({
    summary: z
      .object({
        window_days: z.number().int().positive(),
        total_attempts: z.number().int().nonnegative(),
        total_reports: z.number().int().nonnegative(),
        accuracy: z.number().min(0).max(1),
        cutoff_exceeded_rate: z.number().min(0).max(1),
      })
      .strict(),
    section_accuracy: z.array(
      z
        .object({
          section: problemSectionSchema,
          total: z.number().int().nonnegative(),
          correct: z.number().int().nonnegative(),
          accuracy: z.number().min(0).max(1),
          cutoff_exceeded_rate: z.number().min(0).max(1),
        })
        .strict(),
    ),
    subtype_weakness: z.array(
      z
        .object({
          section: problemSectionSchema,
          sub_type: nonEmpty,
          total: z.number().int().nonnegative(),
          incorrect: z.number().int().nonnegative(),
          accuracy: z.number().min(0).max(1),
          cutoff_exceeded_rate: z.number().min(0).max(1),
        })
        .strict(),
    ),
    error_distribution: z.array(
      z
        .object({
          section: problemSectionSchema,
          failure_stage: nonEmpty,
          error_type: nonEmpty,
          count: z.number().int().nonnegative(),
          ratio: z.number().min(0).max(1),
        })
        .strict(),
    ),
    trend: z.array(
      z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          total_attempts: z.number().int().nonnegative(),
          correct_attempts: z.number().int().nonnegative(),
          accuracy: z.number().min(0).max(1),
          error_reports: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    source_distribution: z.array(
      z
        .object({
          source: nonEmpty,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    totals: z
      .object({
        problems: z.number().int().nonnegative(),
        reports: z.number().int().nonnegative(),
      })
      .strict(),
    filters_applied: z
      .object({
        days: z.number().int().positive(),
        section: problemSectionSchema.nullable(),
        source: z.string().trim().nullable(),
      })
      .strict(),
  })
  .strict();

export type WeaknessQueryInput = z.infer<typeof weaknessQuerySchema>;
export type WeaknessDashboardOutput = z.infer<typeof weaknessDashboardResponseSchema>;
