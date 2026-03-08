import type { GenerateAiProblemInput } from "@/lib/contracts/problem-contracts";
import type { GenerationMode } from "@/lib/types";

const DEFAULT_OPENAI_MODEL = "gpt-5.4";
const MOCK_MODEL = "mock-gmat-v1";
const PROMPT_VERSION = "gmat-805-generate-v1";

export interface GeneratedProblemDraft {
  stem: string;
  choices: string[];
  answer_index: number;
  explanation: string;
}

export interface GenerationContext {
  provider: GenerationMode;
  model: string;
  prompt_version: string;
  seed: number | null;
}

function buildMockDraft(input: GenerateAiProblemInput): GeneratedProblemDraft {
  if (input.section_hint === "quant") {
    return {
      stem: "If x + 2 = 11, what is the value of x?",
      choices: ["7", "8", "9", "11", "13"],
      answer_index: 2,
      explanation: "x = 11 - 2 = 9",
    };
  }

  if (input.section_hint === "di") {
    return {
      stem: "A table shows monthly sales. Which month has the highest growth rate?",
      choices: ["January", "February", "March", "April", "Cannot be determined"],
      answer_index: 3,
      explanation: "April has the largest percentage increase.",
    };
  }

  return {
    stem: "Which of the following most strengthens the argument?",
    choices: [
      "A new study weakens the conclusion.",
      "The effect appeared before the cause.",
      "An alternative cause is ruled out by new evidence.",
      "The sample is unrelated to the claim.",
      "The conclusion repeats the premise.",
    ],
    answer_index: 2,
    explanation: "Eliminating an alternative cause strengthens the causal claim.",
  };
}

function buildMockDrafts(input: GenerateAiProblemInput): GeneratedProblemDraft[] {
  return Array.from({ length: input.count }, () => buildMockDraft(input));
}

function sanitizeDraft(raw: unknown): GeneratedProblemDraft | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as {
    stem?: unknown;
    choices?: unknown;
    answer_index?: unknown;
    explanation?: unknown;
  };

  if (typeof payload.stem !== "string") {
    return null;
  }

  if (!Array.isArray(payload.choices) || payload.choices.length < 2) {
    return null;
  }

  const choices = payload.choices
    .filter((choice): choice is string => typeof choice === "string")
    .map((choice) => choice.trim())
    .filter((choice) => choice.length > 0);

  if (choices.length < 2) {
    return null;
  }

  if (
    typeof payload.answer_index !== "number" ||
    !Number.isInteger(payload.answer_index) ||
    payload.answer_index < 0 ||
    payload.answer_index >= choices.length
  ) {
    return null;
  }

  return {
    stem: payload.stem.trim(),
    choices,
    answer_index: payload.answer_index,
    explanation:
      typeof payload.explanation === "string" && payload.explanation.trim().length > 0
        ? payload.explanation.trim()
        : "No explanation provided.",
  };
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

function parseOpenAiItems(rawText: string): GeneratedProblemDraft[] {
  const parsed = JSON.parse(rawText) as {
    items?: unknown[];
    stem?: unknown;
    choices?: unknown;
    answer_index?: unknown;
    explanation?: unknown;
  };

  if (Array.isArray(parsed.items)) {
    return parsed.items
      .map((item) => sanitizeDraft(item))
      .filter((item): item is GeneratedProblemDraft => item !== null);
  }

  const single = sanitizeDraft(parsed);
  return single ? [single] : [];
}

async function callOpenAi(
  input: GenerateAiProblemInput,
): Promise<{ drafts: GeneratedProblemDraft[]; model: string } | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const prompt = {
    topic: input.topic,
    section_hint: input.section_hint,
    difficulty: input.difficulty,
    count: input.count,
    instruction:
      "Create GMAT Focus multiple-choice questions. Return strict JSON only: {\"items\":[{\"stem\":string,\"choices\":string[],\"answer_index\":number,\"explanation\":string}]}.",
  };

  const requestBody: Record<string, unknown> = {
    model,
    temperature: 0.6,
    max_output_tokens: 1200,
    input: [
      {
        role: "system",
        content:
          "You are a GMAT item generator. Follow the JSON shape exactly and do not include markdown.",
      },
      {
        role: "user",
        content: JSON.stringify(prompt),
      },
    ],
  };

  if (typeof input.seed === "number") {
    requestBody.seed = input.seed;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return null;
    }

    const raw = (await response.json()) as unknown;
    const text = extractTextFromResponse(raw);
    if (!text) {
      return null;
    }

    const drafts = parseOpenAiItems(text);
    if (drafts.length !== input.count) {
      return null;
    }

    return { drafts, model };
  } catch {
    return null;
  }
}

export async function generateProblemDrafts(input: GenerateAiProblemInput): Promise<{
  drafts: GeneratedProblemDraft[];
  generationMode: GenerationMode;
  context: GenerationContext;
}> {
  const openAiResult = await callOpenAi(input);

  if (openAiResult) {
    return {
      drafts: openAiResult.drafts,
      generationMode: "openai",
      context: {
        provider: "openai",
        model: openAiResult.model,
        prompt_version: PROMPT_VERSION,
        seed: typeof input.seed === "number" ? input.seed : null,
      },
    };
  }

  return {
    drafts: buildMockDrafts(input),
    generationMode: "mock",
    context: {
      provider: "mock",
      model: MOCK_MODEL,
      prompt_version: PROMPT_VERSION,
      seed: typeof input.seed === "number" ? input.seed : null,
    },
  };
}
