import Anthropic from "@anthropic-ai/sdk";

import {
  analyzeReportResponseSchema,
  type AnalyzeReportInput,
  type AnalyzeReportOutput,
} from "@/lib/contracts/report-contracts";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function buildFallbackAnalysis(input: AnalyzeReportInput): AnalyzeReportOutput {
  return {
    wrong_choices: `A: 결론과 직접 연결되지 않아 오답 (scope). B: 그럴듯하지만 핵심 가정을 건드리지 못함 (irrelevant). C: 인과 방향을 뒤집어 해석함 (reversal). D: 정답 논리와 가장 직접적으로 연결됨.`,
    core_principle: `핵심은 결론-근거 연결고리를 먼저 고정하는 것입니다. ${input.correct_mechanism}`,
    emotional_diary: `너는 '${input.my_frame}' 프레임에 먼저 고정돼 선지를 좁혔어. 다음엔 선지 전에 결론과 숨은 가정을 한 줄로 재고정해.`,
    visual_concept: `[Premise] -> [Hidden Assumption] -> [Conclusion]\n             ^\n      정답 선지는 이 연결을 강화/보완`,
  };
}

export async function analyzeReportWithClaude(
  input: AnalyzeReportInput,
): Promise<AnalyzeReportOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackAnalysis(input);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    max_tokens: 800,
    temperature: 0,
    system:
      "You are a GMAT Focus tutor. Return strict JSON with exactly four keys: wrong_choices, core_principle, emotional_diary, visual_concept. Write in Korean.",
    messages: [
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
  });

  const rawText = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  try {
    const parsed = JSON.parse(rawText);
    return analyzeReportResponseSchema.parse(parsed);
  } catch {
    return analyzeReportResponseSchema.parse(buildFallbackAnalysis(input));
  }
}
