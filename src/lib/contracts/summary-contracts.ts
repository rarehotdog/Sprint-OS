import { z } from "zod";

import { problemSectionSchema } from "@/lib/contracts/problem-contracts";

const nonEmpty = z.string().trim().min(1);
const dateYmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const summaryVersionSchema = z.enum(["today", "eve", "day"]);

export const summaryBuildRequestSchema = z.object({
  trigger: z.enum(["consolidation", "manual"]),
  version: z.enum(["today", "eve", "day", "both", "all"]).optional().default("both"),
  date: dateYmdSchema.optional(),
});

export const summaryBookletQuerySchema = z.object({
  version: summaryVersionSchema,
});

export const sourceCountsSchema = z
  .object({
    total_reports: z.number().int().nonnegative(),
    quick_reports: z.number().int().nonnegative(),
    deep_reports: z.number().int().nonnegative(),
    rules: z.number().int().nonnegative(),
    due_reviews: z.number().int().nonnegative(),
    weak_subtypes: z.number().int().nonnegative(),
    error_patterns: z.number().int().nonnegative(),
  })
  .strict();

export const summarySubTypeSchema = z
  .object({
    section: problemSectionSchema,
    sub_type: nonEmpty,
    total: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1),
  })
  .strict();

export const summaryErrorPatternSchema = z
  .object({
    section: problemSectionSchema,
    failure_stage: nonEmpty,
    error_type: nonEmpty,
    count: z.number().int().nonnegative(),
    ratio: z.number().min(0).max(1),
  })
  .strict();

export const summarySectionsSchema = z
  .object({
    concepts: z.array(nonEmpty),
    process_flows: z.array(nonEmpty),
    tips: z.array(nonEmpty),
    checklist: z.array(nonEmpty),
  })
  .strict();

export const summaryDiagnosticsSchema = z
  .object({
    source_counts: sourceCountsSchema,
    weak_subtypes: z.array(summarySubTypeSchema),
    error_patterns: z.array(summaryErrorPatternSchema),
  })
  .strict();

export const summaryBookletSchema = z
  .object({
    version: summaryVersionSchema,
    built_at: z.string().datetime(),
    summary: nonEmpty,
    sections: summarySectionsSchema,
    diagnostics: summaryDiagnosticsSchema,
  })
  .strict();

export const summaryBuildResponseSchema = z
  .object({
    builds: z.array(
      z
        .object({
          version: summaryVersionSchema,
          built_at: z.string().datetime(),
          source_counts: sourceCountsSchema,
          sections_count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

export const summaryExportQuerySchema = z.object({
  version: summaryVersionSchema,
  format: z.literal("markdown").optional().default("markdown"),
});

export const summaryExportResponseSchema = z
  .object({
    filename: nonEmpty,
    content: z.string(),
  })
  .strict();

export const summaryQuerySchema = z.object({
  mode: z.enum(["day_before", "exam_day"]).optional().default("day_before"),
  days: z.coerce.number().int().min(1).max(30).optional().default(14),
});

export type SummaryVersion = z.infer<typeof summaryVersionSchema>;
export type SummaryBuildInput = z.infer<typeof summaryBuildRequestSchema>;
export type SummaryBookletQueryInput = z.infer<typeof summaryBookletQuerySchema>;
export type SummaryBookletOutput = z.infer<typeof summaryBookletSchema>;
export type SummaryBuildOutput = z.infer<typeof summaryBuildResponseSchema>;
export type SummaryExportQueryInput = z.infer<typeof summaryExportQuerySchema>;
export type SummaryExportOutput = z.infer<typeof summaryExportResponseSchema>;
export type SummaryQueryInput = z.infer<typeof summaryQuerySchema>;
