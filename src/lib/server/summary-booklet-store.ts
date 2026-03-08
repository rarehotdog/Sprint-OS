import type {
  SourceCounts,
  SummaryBooklet,
  SummaryErrorPattern,
  SummarySubType,
  SummaryVersion,
} from "@/lib/types";

import type {
  SummaryBuildInput,
  SummaryBuildOutput,
  SummaryExportOutput,
} from "@/lib/contracts/summary-contracts";

import { getWeaknessAnalytics } from "@/lib/server/weakness-analytics";
import { listAnswerFlows, listSummaryCards } from "@/lib/server/knowledge-stack-store";
import { listQueueItems } from "@/lib/server/review-queue-store";
import { listReports, listRules } from "@/lib/server/report-store";

interface SummaryDb {
  byVersion: Map<SummaryVersion, SummaryBooklet>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatSummaryDb__: SummaryDb | undefined;
}

function getDb(): SummaryDb {
  if (!global.__gmatSummaryDb__) {
    global.__gmatSummaryDb__ = {
      byVersion: new Map<SummaryVersion, SummaryBooklet>(),
    };
  }

  return global.__gmatSummaryDb__;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDateCompact(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

function dedupeNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function getVersions(version: "today" | "eve" | "day" | "both" | "all"): SummaryVersion[] {
  if (version === "all") {
    return ["today", "eve", "day"];
  }

  if (version === "both") {
    return ["eve", "day"];
  }

  return [version];
}

function computeSourceCounts(): SourceCounts {
  const reports = listReports();
  const rules = listRules();
  const now = Date.now();
  const dueReviews = listQueueItems().filter((item) => {
    const parsed = new Date(item.next_review_at).getTime();
    return Number.isFinite(parsed) && parsed <= now;
  }).length;
  const weakness = getWeaknessAnalytics({ days: 14 });

  return {
    total_reports: reports.length,
    quick_reports: reports.filter((report) => report.report_mode === "quick").length,
    deep_reports: reports.filter((report) => report.report_mode === "deep").length,
    rules: rules.length,
    due_reviews: dueReviews,
    weak_subtypes: weakness.subtype_weakness.length,
    error_patterns: weakness.error_distribution.length,
  };
}

function computeDiagnostics(): {
  weakSubtypes: SummarySubType[];
  errorPatterns: SummaryErrorPattern[];
} {
  const weakness = getWeaknessAnalytics({ days: 14 });
  return {
    weakSubtypes: weakness.subtype_weakness.slice(0, 7).map((item) => ({
      section: item.section,
      sub_type: item.sub_type,
      total: item.total,
      incorrect: item.incorrect,
      accuracy: item.accuracy,
    })),
    errorPatterns: weakness.error_distribution.slice(0, 7).map((item) => ({
      section: item.section,
      failure_stage: item.failure_stage,
      error_type: item.error_type,
      count: item.count,
      ratio: item.ratio,
    })),
  };
}

function buildConcepts(version: SummaryVersion): string[] {
  const cardConcepts = listSummaryCards(40)
    .filter((card) => card.card_type === "concept" || card.card_type === "mechanism")
    .map((card) => card.content);

  if (cardConcepts.length > 0) {
    if (version === "eve") {
      return dedupeNonEmpty(cardConcepts).slice(0, 8);
    }
    if (version === "today") {
      return dedupeNonEmpty(cardConcepts).slice(0, 5);
    }
    return dedupeNonEmpty(cardConcepts).slice(0, 4);
  }

  const reports = listReports();
  const fromReports = dedupeNonEmpty(
    reports
      .filter((report) => report.report_mode === "deep")
      .flatMap((report) => [report.ai_core_principle, report.mechanism_english, report.correct_mechanism]),
  );

  if (fromReports.length > 0) {
    if (version === "eve") {
      return fromReports.slice(0, 8);
    }
    if (version === "today") {
      return fromReports.slice(0, 5);
    }
    return fromReports.slice(0, 4);
  }

  if (version === "eve") {
    return [
      "정답보다 먼저 결론/조건/단위를 명시하고 선지를 본다.",
      "정확도를 고정한 뒤 시간은 컷오프 기준으로만 제어한다.",
      "오답을 외우지 말고 오답이 매력적으로 보인 이유를 분해한다.",
    ];
  }

  if (version === "today") {
    return [
      "오늘 약점 1순위를 먼저 처리하고 새 문제로 넘어간다.",
      "정답보다 메커니즘 문장을 먼저 고정한다.",
      "컷오프 초과 전 Guess & Go를 실행한다.",
    ];
  }

  return [
    "결론/단위/분모 먼저.",
    "매력 선지에 반응하지 말고 질문 요구를 재확인.",
    "컷오프 넘기면 Guess & Go.",
  ];
}

function buildProcessFlows(version: SummaryVersion): string[] {
  const answerFlows = listAnswerFlows(12).map(
    (flow) =>
      `Ask: ${flow.ask} -> Key Factor: ${flow.key_factor} -> Mechanism: ${flow.mechanism} -> Check: ${flow.check}`,
  );

  if (answerFlows.length > 0) {
    if (version === "eve") {
      return dedupeNonEmpty(answerFlows).slice(0, 6);
    }
    if (version === "today") {
      return dedupeNonEmpty(answerFlows).slice(0, 4);
    }
    return dedupeNonEmpty(answerFlows).slice(0, 3);
  }

  const cardFlows = listSummaryCards(40)
    .filter((card) => card.card_type === "flow")
    .map((card) => card.content);

  if (cardFlows.length > 0) {
    if (version === "eve") {
      return dedupeNonEmpty(cardFlows).slice(0, 6);
    }
    if (version === "today") {
      return dedupeNonEmpty(cardFlows).slice(0, 4);
    }
    return dedupeNonEmpty(cardFlows).slice(0, 3);
  }

  const reports = listReports();
  const flows = dedupeNonEmpty(
    reports.map(
      (report) =>
        `내 프레임: ${report.my_frame} -> 정답 메커니즘: ${report.correct_mechanism} -> 다음 도구: ${report.next_tool}`,
    ),
  );

  if (flows.length > 0) {
    if (version === "eve") {
      return flows.slice(0, 6);
    }
    if (version === "today") {
      return flows.slice(0, 4);
    }
    return flows.slice(0, 3);
  }

  if (version === "eve") {
    return [
      "문제 요구 재진술 -> 핵심 정보 표기 -> 선지 비교 -> 검증 체크 -> 제출",
      "틀린 선택지 이유 기록 -> 정답 메커니즘 한 줄화 -> 다음 도구 고정",
    ];
  }

  if (version === "today") {
    return [
      "어제 약점 재진입 -> Ask/Key Factor 고정 -> 제출 후 Quick 기록",
      "Deep 확장 1개 완료 -> Rule 후보 1개 추출",
    ];
  }

  return ["요구 재진술 -> 핵심 표기 -> 선지 검증 -> 제출"];
}

function buildTips(version: SummaryVersion): string[] {
  const cardTips = listSummaryCards(40)
    .filter((card) => card.card_type === "tip" || card.card_type === "trap")
    .map((card) => card.content);

  if (cardTips.length > 0) {
    if (version === "eve") {
      return dedupeNonEmpty(cardTips).slice(0, 10);
    }
    if (version === "today") {
      return dedupeNonEmpty(cardTips).slice(0, 6);
    }
    return dedupeNonEmpty(cardTips).slice(0, 5);
  }

  const rules = listRules();
  const diagnostics = computeDiagnostics();
  const ruleTips = dedupeNonEmpty(rules.map((rule) => rule.content));
  const errorTips = diagnostics.errorPatterns.map(
    (item) =>
      `${item.section}/${item.failure_stage}/${item.error_type}: 비율 ${(item.ratio * 100).toFixed(0)}%`,
  );
  const merged = dedupeNonEmpty([...ruleTips, ...errorTips]);

  if (merged.length > 0) {
    if (version === "eve") {
      return merged.slice(0, 10);
    }
    if (version === "today") {
      return merged.slice(0, 6);
    }
    return merged.slice(0, 5);
  }

  if (version === "eve") {
    return [
      "CR: 결론(C) 다시 쓰고 gap을 선지와 직접 매칭한다.",
      "QR%: 분모(기준값)를 먼저 적고 비율 관계를 확정한다.",
      "DI: 축/단위/범례 체크 후 계산에 들어간다.",
    ];
  }

  if (version === "today") {
    return [
      "오늘 첫 블록은 due review + yesterday weakness.",
      "Quick 3문장 완료 후 다음 문제로 즉시 전진.",
      "Consolidation에서 booklet 후보 1개 이상 갱신.",
    ];
  }

  return [
    "C/P/A/Gap 한 줄 점검.",
    "분모와 단위 확인.",
    "컷오프 초과 시 즉시 전진.",
  ];
}

function buildChecklist(version: SummaryVersion): string[] {
  if (version === "today") {
    return [
      "체크인 입력 완료(energy/focus/stress/sleep/confidence)",
      "어제 약점 1~3개 먼저 처리",
      "Due Review 큐 선행 처리",
      "오늘 main block 1개 완료",
      "Consolidation + Booklet refresh 완료",
    ];
  }

  if (version === "eve") {
    return [
      "오늘 틀린 문제 3개를 Quick->Deep까지 확장했는지 확인",
      "Top Rule 5개를 소리 내어 재인출",
      "RC는 문단 기능 태그 후 문제 진입",
      "QR/DI는 단위와 분모를 식보다 먼저 기록",
      "타이머 압박 시 Guess & Go 규칙 재확인",
      "수면/컨디션/시험장 동선 체크 완료",
    ];
  }

  return [
    "Top Rule 3개 재확인",
    "첫 5문항 정확도 우선",
    "컷오프 넘기면 즉시 이동",
    "검증 10초 루틴(부호/단위/질문요구) 실행",
  ];
}

function buildSummaryLine(version: SummaryVersion, sourceCounts: SourceCounts): string {
  if (version === "today") {
    return `오늘판: due review ${sourceCounts.due_reviews}개와 반복 약점을 먼저 반영해 즉시 실행 가능한 루프로 정리했습니다.`;
  }

  if (version === "eve") {
    return `전날판: Quick ${sourceCounts.quick_reports}개, Deep ${sourceCounts.deep_reports}개에서 반복된 오류를 과정 중심으로 압축했습니다.`;
  }

  return `당일판: 최종 체크리스트와 금지 실수를 초압축해 시험 직전 5분 복습용으로 정리했습니다.`;
}

function buildSingleVersion(version: SummaryVersion): SummaryBooklet {
  const builtAt = nowIso();
  const sourceCounts = computeSourceCounts();
  const diagnostics = computeDiagnostics();
  const sections = {
    concepts: buildConcepts(version),
    process_flows: buildProcessFlows(version),
    tips: buildTips(version),
    checklist: buildChecklist(version),
  };

  return {
    version,
    built_at: builtAt,
    summary: buildSummaryLine(version, sourceCounts),
    sections,
    diagnostics: {
      source_counts: sourceCounts,
      weak_subtypes: diagnostics.weakSubtypes,
      error_patterns: diagnostics.errorPatterns,
    },
  };
}

export function buildSummaryBooklet(input: SummaryBuildInput): SummaryBuildOutput {
  const versions = getVersions(input.version ?? "both");
  const db = getDb();
  const builds = versions.map((version) => {
    const built = buildSingleVersion(version);
    db.byVersion.set(version, built);

    return {
      version: built.version,
      built_at: built.built_at,
      source_counts: built.diagnostics.source_counts,
      sections_count:
        built.sections.concepts.length +
        built.sections.process_flows.length +
        built.sections.tips.length +
        built.sections.checklist.length,
    };
  });

  return { builds };
}

export function getSummaryBooklet(version: SummaryVersion): SummaryBooklet | null {
  return getDb().byVersion.get(version) ?? null;
}

export function ensureSummaryBooklet(version: SummaryVersion): SummaryBooklet {
  const existing = getSummaryBooklet(version);
  if (existing) {
    return existing;
  }

  const built = buildSingleVersion(version);
  getDb().byVersion.set(version, built);
  return built;
}

function toMarkdown(booklet: SummaryBooklet): string {
  const lines: string[] = [
    `# GMAT 805 ${booklet.version.toUpperCase()} 요약집`,
    "",
    `- built_at: ${booklet.built_at}`,
    `- summary: ${booklet.summary}`,
    "",
    "## Concepts",
    ...booklet.sections.concepts.map((item) => `- ${item}`),
    "",
    "## Process Flows",
    ...booklet.sections.process_flows.map((item) => `- ${item}`),
    "",
    "## Practical Tips",
    ...booklet.sections.tips.map((item) => `- ${item}`),
    "",
    "## Checklist",
    ...booklet.sections.checklist.map((item) => `- ${item}`),
    "",
    "## Diagnostics",
    `- reports: ${booklet.diagnostics.source_counts.total_reports}`,
    `- quick/deep: ${booklet.diagnostics.source_counts.quick_reports}/${booklet.diagnostics.source_counts.deep_reports}`,
    `- rules: ${booklet.diagnostics.source_counts.rules}`,
    `- due_reviews: ${booklet.diagnostics.source_counts.due_reviews}`,
  ];

  return lines.join("\n");
}

export function exportSummaryBookletMarkdown(version: SummaryVersion): SummaryExportOutput {
  const booklet = ensureSummaryBooklet(version);
  return {
    filename: `gmat-805-${version}-booklet-${toDateCompact(booklet.built_at)}.md`,
    content: toMarkdown(booklet),
  };
}

export function resetSummaryBookletStoreForTests(): void {
  global.__gmatSummaryDb__ = {
    byVersion: new Map<SummaryVersion, SummaryBooklet>(),
  };
}
