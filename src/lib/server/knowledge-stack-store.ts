import type { AnswerFlow, ErrorReport, SummaryCard, SummaryCardType } from "@/lib/types";

interface KnowledgeDb {
  answerFlows: Map<string, AnswerFlow>;
  summaryCards: Map<string, SummaryCard>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatKnowledgeDb__: KnowledgeDb | undefined;
}

function getDb(): KnowledgeDb {
  if (!global.__gmatKnowledgeDb__) {
    global.__gmatKnowledgeDb__ = {
      answerFlows: new Map<string, AnswerFlow>(),
      summaryCards: new Map<string, SummaryCard>(),
    };
  }

  return global.__gmatKnowledgeDb__;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clean(text: string | null | undefined): string {
  return (text ?? "").trim();
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

function findAnswerFlowByReport(reportId: string): AnswerFlow | null {
  for (const flow of getDb().answerFlows.values()) {
    if (flow.report_id === reportId) {
      return flow;
    }
  }

  return null;
}

function upsertAnswerFlowFromReport(report: ErrorReport): AnswerFlow {
  const timestamp = nowIso();
  const existing = findAnswerFlowByReport(report.id);
  const flow = buildFlowFromReport(report);

  const next: AnswerFlow = {
    id: existing?.id ?? crypto.randomUUID(),
    attempt_id: report.attempt_id,
    report_id: report.id,
    ask: flow.ask,
    key_factor: flow.key_factor,
    mechanism: flow.mechanism,
    check: flow.check,
    created_at: existing?.created_at ?? timestamp,
  };

  getDb().answerFlows.set(next.id, next);
  return next;
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

function upsertSummaryCard(
  report: ErrorReport,
  cardType: SummaryCardType,
  content: string,
): SummaryCard {
  const normalized = content.trim();
  const existing = Array.from(getDb().summaryCards.values()).find(
    (card) =>
      card.source_report_id === report.id &&
      card.card_type === cardType &&
      card.content.trim() === normalized,
  );

  const score = scoreCard(report, cardType);
  const next: SummaryCard = {
    id: existing?.id ?? crypto.randomUUID(),
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
    created_at: existing?.created_at ?? nowIso(),
  };

  getDb().summaryCards.set(next.id, next);
  return next;
}

export function promoteDeepReportToKnowledgeStack(report: ErrorReport): {
  answer_flow: AnswerFlow;
  summary_cards: SummaryCard[];
} {
  const answerFlow = upsertAnswerFlowFromReport(report);
  const cards: SummaryCard[] = [];

  const mechanism = clean(report.mechanism_english) || clean(report.correct_mechanism);
  if (mechanism) {
    cards.push(upsertSummaryCard(report, "mechanism", mechanism));
  }

  const flow = clean(report.logic_comparison);
  if (flow) {
    cards.push(upsertSummaryCard(report, "flow", flow));
  }

  const tip = clean(report.next_tool);
  if (tip) {
    cards.push(upsertSummaryCard(report, "tip", tip));
  }

  const trap = clean(report.my_frame);
  if (trap) {
    cards.push(upsertSummaryCard(report, "trap", trap));
  }

  const concept = clean(report.ai_core_principle);
  if (concept) {
    cards.push(upsertSummaryCard(report, "concept", concept));
  }

  return {
    answer_flow: answerFlow,
    summary_cards: cards,
  };
}

export function listAnswerFlows(limit = 50): AnswerFlow[] {
  return Array.from(getDb().answerFlows.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, Math.max(1, limit));
}

export function getAnswerFlowByReportId(reportId: string): AnswerFlow | null {
  return findAnswerFlowByReport(reportId);
}

export function listSummaryCards(limit = 100): SummaryCard[] {
  return Array.from(getDb().summaryCards.values())
    .sort((a, b) => b.inclusion_score - a.inclusion_score)
    .slice(0, Math.max(1, limit));
}

export function listSummaryCardsByReportId(reportId: string, limit = 10): SummaryCard[] {
  return Array.from(getDb().summaryCards.values())
    .filter((card) => card.source_report_id === reportId)
    .sort((a, b) => b.inclusion_score - a.inclusion_score)
    .slice(0, Math.max(1, limit));
}

export function resetKnowledgeStackStoreForTests(): void {
  global.__gmatKnowledgeDb__ = {
    answerFlows: new Map<string, AnswerFlow>(),
    summaryCards: new Map<string, SummaryCard>(),
  };
}
