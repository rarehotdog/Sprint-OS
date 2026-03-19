import { createHash } from "node:crypto";

import type { AnswerFlow, ErrorReport, SummaryCard, SummaryCardType } from "@/lib/types";

import { listProblems } from "@/lib/server/problems-store";
import { getReportById, listReports, listRules } from "@/lib/server/report-store";
import { listAttempts } from "@/lib/server/solve-store";

function clean(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function buildDerivedUuid(seed: string): string {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16] ?? "0", 16) % 4] ?? "8";
  const normalized = hex.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

function isReportBackedByCuratedProblem(report: ErrorReport): boolean {
  const attempts = listAttempts();
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const problemById = new Map(listProblems().map((problem) => [problem.id, problem]));
  const attempt = attemptById.get(report.attempt_id);
  if (!attempt) {
    return false;
  }

  const problem = problemById.get(attempt.problem_id);
  if (!problem) {
    return false;
  }

  return (
    problem.curation_status === "accepted" &&
    (problem.corpus_tier === "gold" || problem.corpus_tier === "scale")
  );
}

export function listCuratedKnowledgeReports(): ErrorReport[] {
  const attempts = listAttempts();
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const problemById = new Map(listProblems().map((problem) => [problem.id, problem]));

  return listReports().filter((report) => {
    if (report.report_mode !== "deep") {
      return false;
    }

    const attempt = attemptById.get(report.attempt_id);
    if (!attempt) {
      return false;
    }

    const problem = problemById.get(attempt.problem_id);
    if (!problem) {
      return false;
    }

    return (
      problem.curation_status === "accepted" &&
      (problem.corpus_tier === "gold" || problem.corpus_tier === "scale")
    );
  });
}

export function listBookletEligibleRules() {
  const eligibleReportIds = new Set(
    listReports()
      .filter((report) => isReportBackedByCuratedProblem(report))
      .map((report) => report.id),
  );

  return listRules().filter((rule) => !rule.source_report_id || eligibleReportIds.has(rule.source_report_id));
}

function buildFlowFromReport(report: ErrorReport): {
  ask: string;
  key_factor: string;
  mechanism: string;
  check: string;
} {
  const ask = clean(report.error_type)
    ? `What is this question really asking? (${clean(report.error_type)})`
    : "What is this question really asking?";

  const keyFactor = clean(report.next_tool) || "Identify the one key factor before evaluating choices.";
  const mechanism = clean(report.mechanism_english) || clean(report.correct_mechanism);
  const check = clean(report.logic_comparison) || "Check against conclusion/units/cutoff before submit.";

  return {
    ask,
    key_factor: keyFactor,
    mechanism: mechanism || "State why this answer must be correct in one mechanism sentence.",
    check,
  };
}

function buildAnswerFlow(report: ErrorReport): AnswerFlow {
  const flow = buildFlowFromReport(report);

  return {
    id: buildDerivedUuid(`${report.id}:answer-flow`),
    attempt_id: report.attempt_id,
    report_id: report.id,
    ask: flow.ask,
    key_factor: flow.key_factor,
    mechanism: flow.mechanism,
    check: flow.check,
    created_at: report.deepened_at ?? report.created_at,
  };
}

function scoreCard(report: ErrorReport, cardType: SummaryCardType): number {
  const deepScore = report.report_mode === "deep" ? 0.35 : 0;
  const aiScore = report.ai_core_principle ? 0.25 : 0;
  const typeWeight: Record<SummaryCardType, number> = {
    concept: 0.15,
    mechanism: 0.25,
    trap: 0.2,
    tip: 0.15,
    flow: 0.2,
  };

  return Math.min(1, 0.2 + deepScore + aiScore + typeWeight[cardType]);
}

function buildSummaryCard(
  report: ErrorReport,
  cardType: SummaryCardType,
  content: string,
): SummaryCard {
  const normalized = content.trim();
  const score = scoreCard(report, cardType);

  return {
    id: buildDerivedUuid(`${report.id}:${cardType}:${normalized}`),
    card_type: cardType,
    section: null,
    sub_type: null,
    content: normalized,
    source_attempt_id: report.attempt_id,
    source_report_id: report.id,
    source_rule_id: null,
    source_capture_id: null,
    inclusion_score: score,
    exam_eve_priority: Math.min(1, score + 0.1),
    exam_day_priority: Math.max(0, score - 0.1),
    created_at: report.deepened_at ?? report.created_at,
  };
}

function buildSummaryCardsFromReport(report: ErrorReport): SummaryCard[] {
  const cards: SummaryCard[] = [];

  const mechanism = clean(report.mechanism_english) || clean(report.correct_mechanism);
  if (mechanism) {
    cards.push(buildSummaryCard(report, "mechanism", mechanism));
  }

  const flow = clean(report.logic_comparison);
  if (flow) {
    cards.push(buildSummaryCard(report, "flow", flow));
  }

  const tip = clean(report.next_tool);
  if (tip) {
    cards.push(buildSummaryCard(report, "tip", tip));
  }

  const trap = clean(report.my_frame);
  if (trap) {
    cards.push(buildSummaryCard(report, "trap", trap));
  }

  const concept = clean(report.ai_core_principle);
  if (concept) {
    cards.push(buildSummaryCard(report, "concept", concept));
  }

  return cards;
}

export function promoteDeepReportToKnowledgeStack(report: ErrorReport): {
  answer_flow: AnswerFlow;
  summary_cards: SummaryCard[];
} {
  return {
    answer_flow: buildAnswerFlow(report),
    summary_cards: buildSummaryCardsFromReport(report),
  };
}

export function listAnswerFlows(limit = 50): AnswerFlow[] {
  return listCuratedKnowledgeReports()
    .map((report) => buildAnswerFlow(report))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, Math.max(1, limit));
}

export function getAnswerFlowByReportId(reportId: string): AnswerFlow | null {
  const report = getReportById(reportId);
  if (!report || report.report_mode !== "deep") {
    return null;
  }

  const curatedIds = new Set(listCuratedKnowledgeReports().map((item) => item.id));
  if (!curatedIds.has(report.id)) {
    return null;
  }

  return buildAnswerFlow(report);
}

export function listSummaryCards(limit = 100): SummaryCard[] {
  const cards = listCuratedKnowledgeReports()
    .flatMap((report) => buildSummaryCardsFromReport(report))
    .sort((a, b) => b.inclusion_score - a.inclusion_score);

  return cards.slice(0, Math.max(1, limit));
}

export function listSummaryCardsByReportId(reportId: string, limit = 10): SummaryCard[] {
  const report = getReportById(reportId);
  if (!report || report.report_mode !== "deep") {
    return [];
  }

  const curatedIds = new Set(listCuratedKnowledgeReports().map((item) => item.id));
  if (!curatedIds.has(report.id)) {
    return [];
  }

  return buildSummaryCardsFromReport(report)
    .sort((a, b) => b.inclusion_score - a.inclusion_score)
    .slice(0, Math.max(1, limit));
}

export function resetKnowledgeStackStoreForTests(): void {
  // Derived read model: nothing to reset independently.
}
