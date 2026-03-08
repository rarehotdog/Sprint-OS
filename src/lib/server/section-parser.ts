import { z } from "zod";

import type { ParsedSectionResult } from "@/lib/contracts/problem-contracts";

type Section = "verbal" | "quant" | "di";

interface ParserInput {
  stem: string;
  choices: string[];
}

const REVIEW_THRESHOLD = 0.72;
const DEFAULT_OPENAI_MODEL = "gpt-5.4";

const aiSectionSchema = z
  .object({
    section: z.enum(["verbal", "quant", "di"]),
    sub_type: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

function withReviewFlag(
  payload: Omit<ParsedSectionResult, "needs_review">,
): ParsedSectionResult {
  return {
    ...payload,
    needs_review: payload.confidence < REVIEW_THRESHOLD,
  };
}

function baseRuleParse(input: ParserInput): ParsedSectionResult {
  const text = `${input.stem} ${input.choices.join(" ")}`.toLowerCase();

  if (
    text.includes("conclusion") ||
    text.includes("strengthen") ||
    text.includes("weaken") ||
    text.includes("inference") ||
    text.includes("passage")
  ) {
    return withReviewFlag({
      section: "verbal",
      sub_type: text.includes("passage") ? "rc_inference" : "cr_inference",
      confidence: 0.76,
      parser_mode: "rule",
    });
  }

  if (
    text.includes("table") ||
    text.includes("rate") ||
    text.includes("data") ||
    text.includes("graph")
  ) {
    return withReviewFlag({
      section: "di",
      sub_type: "table_analysis",
      confidence: 0.74,
      parser_mode: "rule",
    });
  }

  return withReviewFlag({
    section: "quant",
    sub_type: "algebra",
    confidence: 0.62,
    parser_mode: "rule",
  });
}

function normalizeSection(value: string): Section | null {
  if (value === "verbal" || value === "quant" || value === "di") {
    return value;
  }

  return null;
}

function extractTextFromResponse(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    const collected = payload.output
      .flatMap((entry) => entry.content ?? [])
      .map((item) => (typeof item.text === "string" ? item.text.trim() : ""))
      .filter((text) => text.length > 0);

    if (collected.length > 0) {
      return collected.join("\n");
    }
  }

  const chatText = payload.choices?.[0]?.message?.content;
  if (typeof chatText === "string" && chatText.trim().length > 0) {
    return chatText.trim();
  }

  return null;
}

async function aiCorrection(input: ParserInput): Promise<ParsedSectionResult | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const prompt = {
    stem: input.stem,
    choices: input.choices,
    instruction:
      "Classify GMAT problem section and subtype. Return strict JSON: {section, sub_type, confidence}. section must be verbal|quant|di.",
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        input: [
          {
            role: "system",
            content:
              "You classify GMAT question section/subtype. Return JSON only and do not add markdown.",
          },
          {
            role: "user",
            content: JSON.stringify(prompt),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const raw = (await response.json()) as unknown;
    const text = extractTextFromResponse(raw);
    if (!text) {
      return null;
    }

    const parsed = aiSectionSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return null;
    }

    const section = normalizeSection(parsed.data.section);
    if (!section) {
      return null;
    }

    return withReviewFlag({
      section,
      sub_type: parsed.data.sub_type,
      confidence: parsed.data.confidence,
      parser_mode: "ai_correction",
    });
  } catch {
    return null;
  }
}

export async function parseSectionHybrid(input: ParserInput): Promise<ParsedSectionResult> {
  const rule = baseRuleParse(input);
  if (!rule.needs_review) {
    return rule;
  }

  const corrected = await aiCorrection(input);
  if (corrected) {
    return corrected;
  }

  return rule;
}
