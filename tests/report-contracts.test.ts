import { describe, expect, it } from "vitest";

import {
  analyzeReportResponseSchema,
  createQuickReportSchema,
} from "../src/lib/contracts/report-contracts";
import {
  attachAiAnalysis,
  createQuickReport,
  deepenReport,
  listPendingDeepReports,
  resetReportStoreForTests,
} from "../src/lib/server/report-store";

describe("quick report contract", () => {
  it("rejects payloads when quick required fields are missing", () => {
    const parsed = createQuickReportSchema.safeParse({
      attempt_id: crypto.randomUUID(),
      failure_stage: "strategy",
      error_type: "scope",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("quick -> deep flow", () => {
  it("moves a quick report to deep and stores AI analysis", () => {
    resetReportStoreForTests();

    const { report: quick } = createQuickReport({
      attempt_id: crypto.randomUUID(),
      report_mode: "quick",
      my_frame: "나는 선택지의 그럴듯함에 끌렸다",
      correct_mechanism: "결론의 인과 연결을 직접 강화하는 선지가 정답이다",
      next_tool: "Q: 결론-가정 연결은? -> F: 대안 원인 제거 여부",
      failure_stage: "strategy",
      error_type: "tempting_choice",
      save_as_rule: false,
    });

    expect(listPendingDeepReports()).toHaveLength(1);
    expect(quick.report_mode).toBe("quick");

    const deep = deepenReport({
      report_id: quick.id,
      mechanism_english:
        "The correct answer strengthens the causal link by ruling out an alternative cause.",
      logic_comparison:
        "내 인출: 그럴듯함 중심 -> 정답 논리: 결론-가정 연결 중심 -> 탑재사고: 연결고리 우선",
      sub_report: {
        cr: {
          conclusion_restated: "결론은 신규 정책이 매출 상승의 원인이라는 주장",
          gap_identified: "경쟁사 가격 인하라는 대안 원인을 배제하지 못함",
          which_choice_attacked_c: "D가 대안 원인을 직접 제거",
        },
      },
      generate_ai: true,
    });

    const analysis = analyzeReportResponseSchema.parse({
      wrong_choices: "A: scope 밖, B: 반대 방향 인과, C: 무관한 비교, D: 정답",
      core_principle: "Strengthen 문제는 결론-가정 연결을 강화하는 증거를 찾는다.",
      emotional_diary: "너는 결론을 재진술하지 않고 선지로 들어가 흔들렸다.",
      visual_concept: "[원인A] -> [결과B], 대안원인C 제거",
    });

    const updated = attachAiAnalysis(deep.id, analysis);

    expect(updated.report_mode).toBe("deep");
    expect(updated.deepened_at).not.toBeNull();
    expect(updated.ai_core_principle).toContain("Strengthen");
    expect(listPendingDeepReports()).toHaveLength(0);
  });
});

describe("analyze-report response contract", () => {
  it("allows only the four fixed keys", () => {
    const parsed = analyzeReportResponseSchema.safeParse({
      wrong_choices: "A: ...",
      core_principle: "핵심",
      emotional_diary: "감정",
      visual_concept: "구조",
      extra: "not allowed",
    });

    expect(parsed.success).toBe(false);
  });
});
