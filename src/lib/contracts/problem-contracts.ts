import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const problemSectionSchema = z.enum(["verbal", "quant", "di"]);
export const problemDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const parserModeSchema = z.enum(["rule", "ai_correction"]);
export const generationModeSchema = z.enum(["openai", "mock"]);
export const reviewStatusSchema = z.enum(["accepted", "needs_review"]);
export const problemSourceTypeSchema = z.enum(["manual", "external", "generated"]);
export const problemCurationStatusSchema = z.enum(["draft", "needs_review", "accepted", "rejected"]);
export const problemCorpusTierSchema = z.enum(["gold", "scale", "filler"]);
export const problemImportInputTypeSchema = z.enum(["text", "csv"]);

export const problemContentSchema = z.object({
  stem: nonEmpty,
  choices: z.array(nonEmpty).min(2),
  passage: z.string().trim().optional(),
  answer_index: z.number().int().min(0).optional(),
  explanation: z.string().trim().optional(),
  image_data_url: z.string().trim().optional(),
  image_ref: z.string().trim().optional(),
  generation_meta: z
    .object({
      provider: generationModeSchema,
      model: nonEmpty,
      prompt_version: nonEmpty,
      seed: z.number().int().nullable(),
      generated_at: z.string().datetime(),
      parser: z
        .object({
          section: problemSectionSchema,
          sub_type: nonEmpty,
          confidence: z.number().min(0).max(1),
          parser_mode: parserModeSchema,
          needs_review: z.boolean(),
        })
        .strict(),
    })
    .strict()
    .optional(),
  import_meta: z
    .object({
      parser: z
        .object({
          section: problemSectionSchema,
          sub_type: nonEmpty,
          confidence: z.number().min(0).max(1),
          parser_mode: parserModeSchema,
          needs_review: z.boolean(),
        })
        .strict(),
    })
    .strict()
    .optional(),
});

export const createProblemSchema = z.object({
  section: problemSectionSchema,
  sub_type: nonEmpty,
  difficulty: problemDifficultySchema.optional(),
  content: problemContentSchema,
  tags: z.array(nonEmpty).optional().default([]),
  source: z.string().trim().optional().default("manual_capture"),
  source_type: problemSourceTypeSchema.optional().default("manual"),
  source_name: z.string().trim().optional(),
  source_url: z.string().trim().optional(),
  external_id: z.string().trim().optional(),
  license_note: z.string().trim().optional(),
  parser_confidence: z.number().min(0).max(1).nullable().optional().default(null),
  curation_status: problemCurationStatusSchema.optional().default("accepted"),
  corpus_tier: problemCorpusTierSchema.optional().default("gold"),
  canonical_hash: z.string().trim().optional(),
  difficulty_estimate: problemDifficultySchema.nullable().optional().default(null),
  explanation_quality: z.number().min(0).max(1).nullable().optional().default(null),
  import_batch_id: z.string().uuid().nullable().optional().default(null),
  last_curated_at: z.string().datetime().nullable().optional().default(null),
  curated_by: z.string().trim().nullable().optional().default(null),
});

export const generateAiProblemSchema = z.object({
  topic: nonEmpty,
  section_hint: z.enum(["verbal", "quant", "di", "auto"]).optional().default("auto"),
  difficulty: problemDifficultySchema.optional().default("medium"),
  count: z.number().int().min(1).max(3).optional().default(1),
  seed: z.number().int().nonnegative().optional(),
});

export const parsedSectionResultSchema = z.object({
  section: problemSectionSchema,
  sub_type: nonEmpty,
  confidence: z.number().min(0).max(1),
  parser_mode: parserModeSchema,
  needs_review: z.boolean(),
}).strict();

export const generationMetaSchema = z
  .object({
    provider: generationModeSchema,
    model: nonEmpty,
    prompt_version: nonEmpty,
    seed: z.number().int().nullable(),
    generated_at: z.string().datetime(),
    parser: parsedSectionResultSchema,
  })
  .strict();

export const importProblemSchema = z
  .object({
    stem: nonEmpty,
    choices: z.array(nonEmpty).min(2),
    section: problemSectionSchema,
    sub_type: nonEmpty,
    difficulty: problemDifficultySchema.optional(),
    answer_index: z.number().int().min(0).optional(),
    explanation: z.string().trim().optional(),
    tags: z.array(nonEmpty).optional().default([]),
    image_ref: z.string().trim().optional(),
    source_name: z.string().trim().optional(),
    source_url: z.string().trim().optional(),
    license_note: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (
      typeof value.answer_index === "number" &&
      value.answer_index >= value.choices.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "answer_index must be less than choices length",
        path: ["answer_index"],
      });
    }
  });

export const reviewStatusActionSchema = z.enum(["accept", "hold", "revise", "reject"]);

export const problemListQuerySchema = z
  .object({
    section: problemSectionSchema.optional(),
    solve_ready: z
      .string()
      .trim()
      .optional()
      .transform((value) => value === "1" || value === "true"),
    problem_ids: z
      .string()
      .trim()
      .optional()
      .transform((value) => {
        if (!value) {
          return [];
        }

        return value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      })
      .pipe(z.array(z.string().uuid()).max(200)),
  })
  .strict();

const problemEntitySchema = z
  .object({
    id: z.string().uuid(),
    section: problemSectionSchema,
    sub_type: nonEmpty,
    difficulty: problemDifficultySchema.nullable(),
    content: z.record(z.string(), z.unknown()),
    tags: z.array(z.string()),
    source: z.string().nullable(),
    source_type: problemSourceTypeSchema.nullable().optional().default(null),
    source_name: z.string().trim().nullable().optional().default(null),
    source_url: z.string().trim().nullable().optional().default(null),
    external_id: z.string().trim().nullable().optional().default(null),
    license_note: z.string().trim().nullable().optional().default(null),
    parser_confidence: z.number().min(0).max(1).nullable().optional().default(null),
    curation_status: problemCurationStatusSchema.nullable().optional().default(null),
    corpus_tier: problemCorpusTierSchema.nullable().optional().default(null),
    canonical_hash: z.string().trim().nullable().optional().default(null),
    difficulty_estimate: problemDifficultySchema.nullable().optional().default(null),
    explanation_quality: z.number().min(0).max(1).nullable().optional().default(null),
    import_batch_id: z.string().uuid().nullable().optional().default(null),
    last_curated_at: z.string().datetime().nullable().optional().default(null),
    curated_by: z.string().trim().nullable().optional().default(null),
    created_at: z.string().datetime(),
  })
  .strict();

export const updateProblemReviewStatusSchema = z
  .object({
    problem_id: z.string().uuid(),
    action: reviewStatusActionSchema,
    section: problemSectionSchema.optional(),
    sub_type: nonEmpty.optional(),
    difficulty_estimate: problemDifficultySchema.optional(),
    source_name: z.string().trim().optional(),
    source_url: z.string().trim().optional(),
    license_note: z.string().trim().optional(),
    corpus_tier: problemCorpusTierSchema.optional(),
    curated_by: z.string().trim().optional(),
    tags: z.array(nonEmpty).optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.action === "revise" &&
      !value.section &&
      !value.sub_type &&
      !value.difficulty_estimate &&
      !value.source_name &&
      !value.source_url &&
      !value.license_note &&
      !value.corpus_tier &&
      !value.tags
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "revise action requires at least one field to update",
        path: ["action"],
      });
    }
  });

export const importProblemResponseSchema = z
  .object({
    problem: problemEntitySchema,
    parser: parsedSectionResultSchema,
    review_status: reviewStatusSchema,
  })
  .strict();

export const problemReviewStatusResponseSchema = z
  .object({
    problem: problemEntitySchema,
    parser: parsedSectionResultSchema.nullable(),
    review_status: reviewStatusSchema,
    duplicate_count: z.number().int().nonnegative(),
  })
  .strict();

export const problemReviewStatusQuerySchema = z.object({
  problem_id: z.string().uuid().optional(),
  review_status: reviewStatusSchema.optional(),
  curation_status: problemCurationStatusSchema.optional(),
  corpus_tier: problemCorpusTierSchema.optional(),
  import_batch_id: z.string().uuid().optional(),
  section: problemSectionSchema.optional(),
  source: nonEmpty.optional(),
  tag: nonEmpty.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const problemReviewStatusListResponseSchema = z
  .object({
    items: z.array(problemReviewStatusResponseSchema),
    total: z.number().int().nonnegative(),
    filters_applied: z
      .object({
        review_status: reviewStatusSchema.nullable(),
        curation_status: problemCurationStatusSchema.nullable(),
        corpus_tier: problemCorpusTierSchema.nullable(),
        import_batch_id: z.string().uuid().nullable(),
        section: problemSectionSchema.nullable(),
        source: z.string().trim().nullable(),
        tag: z.string().trim().nullable(),
        limit: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export const generatedProblemItemSchema = z
  .object({
    problem: problemEntitySchema,
    parser: parsedSectionResultSchema,
    review_status: reviewStatusSchema,
    generation_mode: generationModeSchema,
    generation_meta: generationMetaSchema,
  })
  .strict();

export const generateAiProblemResponseSchema = z
  .object({
    items: z.array(generatedProblemItemSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const listProblemsResponseSchema = z
  .object({
    problems: z.array(problemEntitySchema),
  })
  .strict();

export const problemImportBatchSchema = z
  .object({
    id: z.string().uuid(),
    input_type: problemImportInputTypeSchema,
    source_name: z.string().trim().nullable(),
    source_url: z.string().trim().nullable(),
    license_note: z.string().trim().nullable(),
    notes: z.string().trim().nullable(),
    total_rows: z.number().int().nonnegative(),
    created_rows: z.number().int().nonnegative(),
    invalid_rows: z.number().int().nonnegative(),
    duplicate_rows: z.number().int().nonnegative(),
    created_at: z.string().datetime(),
  })
  .strict();

export const bulkImportProblemsSchema = z.object({
  input_type: problemImportInputTypeSchema,
  raw_payload: nonEmpty,
  source_name: z.string().trim().nullable().optional(),
  source_url: z.string().trim().nullable().optional(),
  license_note: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const bulkImportProblemItemSchema = z
  .object({
    row_number: z.number().int().positive(),
    problem: problemEntitySchema,
    parser: parsedSectionResultSchema,
    review_status: reviewStatusSchema,
    duplicate_count: z.number().int().nonnegative(),
  })
  .strict();

export const bulkImportProblemsResponseSchema = z
  .object({
    batch: problemImportBatchSchema,
    items: z.array(bulkImportProblemItemSchema),
    total_rows: z.number().int().nonnegative(),
    created_rows: z.number().int().nonnegative(),
    invalid_rows: z.number().int().nonnegative(),
    duplicate_rows: z.number().int().nonnegative(),
    errors: z.array(
      z.object({
        row_number: z.number().int().positive(),
        message: nonEmpty,
      }),
    ),
  })
  .strict();

export type CreateProblemInput = z.input<typeof createProblemSchema>;
export type ProblemListQueryInput = z.infer<typeof problemListQuerySchema>;
export type GenerateAiProblemInput = z.infer<typeof generateAiProblemSchema>;
export type ParsedSectionResult = z.infer<typeof parsedSectionResultSchema>;
export type GenerationMeta = z.infer<typeof generationMetaSchema>;
export type ImportProblemInput = z.input<typeof importProblemSchema>;
export type ImportProblemResponse = z.infer<typeof importProblemResponseSchema>;
export type UpdateProblemReviewStatusInput = z.input<typeof updateProblemReviewStatusSchema>;
export type ProblemReviewStatusResponse = z.infer<typeof problemReviewStatusResponseSchema>;
export type ProblemReviewStatusQueryInput = z.infer<typeof problemReviewStatusQuerySchema>;
export type ProblemReviewStatusListResponse = z.infer<typeof problemReviewStatusListResponseSchema>;
export type GeneratedProblemItem = z.infer<typeof generatedProblemItemSchema>;
export type GenerateAiProblemResponse = z.infer<
  typeof generateAiProblemResponseSchema
>;
export type ProblemImportBatch = z.infer<typeof problemImportBatchSchema>;
export type BulkImportProblemsInput = z.input<typeof bulkImportProblemsSchema>;
export type BulkImportProblemsResponse = z.infer<typeof bulkImportProblemsResponseSchema>;
