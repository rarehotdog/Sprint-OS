import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const problemSectionSchema = z.enum(["verbal", "quant", "di"]);
export const problemDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const parserModeSchema = z.enum(["rule", "ai_correction"]);
export const generationModeSchema = z.enum(["openai", "mock"]);
export const reviewStatusSchema = z.enum(["accepted", "needs_review"]);

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

export const reviewStatusActionSchema = z.enum(["accept", "hold", "revise"]);

export const problemListQuerySchema = z
  .object({
    section: problemSectionSchema.optional(),
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
    created_at: z.string().datetime(),
  })
  .strict();

export const updateProblemReviewStatusSchema = z
  .object({
    problem_id: z.string().uuid(),
    action: reviewStatusActionSchema,
    section: problemSectionSchema.optional(),
    sub_type: nonEmpty.optional(),
    tags: z.array(nonEmpty).optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "revise" && !value.section && !value.sub_type && !value.tags) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "revise action requires at least one of section/sub_type/tags",
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
  })
  .strict();

export const problemReviewStatusQuerySchema = z.object({
  problem_id: z.string().uuid().optional(),
  review_status: reviewStatusSchema.optional(),
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

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type ProblemListQueryInput = z.infer<typeof problemListQuerySchema>;
export type GenerateAiProblemInput = z.infer<typeof generateAiProblemSchema>;
export type ParsedSectionResult = z.infer<typeof parsedSectionResultSchema>;
export type GenerationMeta = z.infer<typeof generationMetaSchema>;
export type ImportProblemInput = z.infer<typeof importProblemSchema>;
export type ImportProblemResponse = z.infer<typeof importProblemResponseSchema>;
export type UpdateProblemReviewStatusInput = z.infer<typeof updateProblemReviewStatusSchema>;
export type ProblemReviewStatusResponse = z.infer<typeof problemReviewStatusResponseSchema>;
export type ProblemReviewStatusQueryInput = z.infer<typeof problemReviewStatusQuerySchema>;
export type ProblemReviewStatusListResponse = z.infer<typeof problemReviewStatusListResponseSchema>;
export type GeneratedProblemItem = z.infer<typeof generatedProblemItemSchema>;
export type GenerateAiProblemResponse = z.infer<
  typeof generateAiProblemResponseSchema
>;
