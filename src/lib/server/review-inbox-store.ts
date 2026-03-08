import type {
  AnswerFlow,
  ErrorReport,
  ErrorReportPreview,
  ReviewInboxAction,
  ReviewInboxAnswerFlow,
  ReviewInboxDueSelfTestItem,
  ReviewInboxSnapshot,
  ReviewReportsSnapshot,
} from "@/lib/types";

import {
  getAnswerFlowByReportId,
  listAnswerFlows,
  listSummaryCardsByReportId,
} from "@/lib/server/knowledge-stack-store";
import { getReportById, listPendingDeepReports, listReports } from "@/lib/server/report-store";
import { getQueueItem, listQueueItems } from "@/lib/server/review-queue-store";

function toPreview(report: ErrorReport): ErrorReportPreview {
  return {
    id: report.id,
    attempt_id: report.attempt_id,
    review_queue_id: report.review_queue_id,
    report_mode: report.report_mode,
    my_frame: report.my_frame,
    correct_mechanism: report.correct_mechanism,
    next_tool: report.next_tool,
    error_type: report.error_type,
    created_at: report.created_at,
    deepened_at: report.deepened_at,
  };
}

function toAnswerFlow(flow: AnswerFlow): ReviewInboxAnswerFlow {
  return {
    id: flow.id,
    ask: flow.ask,
    key_factor: flow.key_factor,
    mechanism: flow.mechanism,
    check: flow.check,
    source_report_id: flow.report_id,
    created_at: flow.created_at,
  };
}

function buildDueSelfTestItems(reports: ErrorReport[]): ReviewInboxDueSelfTestItem[] {
  const reportsByQueueId = new Map(
    reports
      .filter((report) => report.review_queue_id)
      .map((report) => [report.review_queue_id as string, report]),
  );
  const now = Date.now();

  return listQueueItems()
    .filter((item) => {
      const nextReviewAt = new Date(item.next_review_at).getTime();
      return Number.isFinite(nextReviewAt) && nextReviewAt <= now;
    })
    .map((item) => {
      const report = reportsByQueueId.get(item.id);
      if (!report) {
        return null;
      }

      return {
        review_queue_id: item.id,
        next_review_at: item.next_review_at,
        priority_score: item.priority_score,
        report: toPreview(report),
      };
    })
    .filter((item): item is ReviewInboxDueSelfTestItem => item !== null)
    .sort((a, b) => {
      if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
      }
      return a.next_review_at.localeCompare(b.next_review_at);
    });
}

function buildNextActions(
  pendingDeepCount: number,
  dueSelfTestCount: number,
  answerFlowCount: number,
): ReviewInboxAction[] {
  const actions: ReviewInboxAction[] = [];

  if (pendingDeepCount > 0) {
    actions.push({
      type: "deepen",
      label: `Deep 대기 ${pendingDeepCount}개`,
      href: "/review/deepen",
      count: pendingDeepCount,
    });
  }

  if (dueSelfTestCount > 0) {
    actions.push({
      type: "self_test",
      label: `Self Test due ${dueSelfTestCount}개`,
      href: "/review/reports",
      count: dueSelfTestCount,
    });
  }

  if (answerFlowCount > 0) {
    actions.push({
      type: "summary",
      label: `Answer Flow ${answerFlowCount}개 복습`,
      href: "/summary?version=today",
      count: answerFlowCount,
    });
  }

  if (actions.length === 0) {
    actions.push({
      type: "summary",
      label: "오늘 요약집 점검",
      href: "/summary?version=today",
      count: 0,
    });
  }

  return actions;
}

export function getReviewInbox(): ReviewInboxSnapshot {
  const reports = listReports();
  const pendingDeep = listPendingDeepReports();
  const dueSelfTest = buildDueSelfTestItems(reports);
  const recentDeep = reports.filter((report) => report.report_mode === "deep");
  const answerFlows = listAnswerFlows(50);

  return {
    counts: {
      total_reports: reports.length,
      pending_deep: pendingDeep.length,
      due_self_test: dueSelfTest.length,
      recent_deep: recentDeep.length,
      answer_flows: answerFlows.length,
    },
    pending_deep: pendingDeep.slice(0, 5).map(toPreview),
    due_self_test: dueSelfTest.slice(0, 5),
    recent_deep: recentDeep.slice(0, 5).map(toPreview),
    answer_flows: answerFlows.slice(0, 6).map(toAnswerFlow),
    next_actions: buildNextActions(pendingDeep.length, dueSelfTest.length, answerFlows.length),
  };
}

export function getReviewReportsView(input?: {
  mode?: "quick" | "deep";
  report_id?: string;
  limit?: number;
}): ReviewReportsSnapshot {
  const inbox = getReviewInbox();
  const limit = Math.max(1, input?.limit ?? 20);
  let reports = listReports();

  if (input?.mode) {
    reports = reports.filter((report) => report.report_mode === input.mode);
  }

  const previews = reports.slice(0, limit).map(toPreview);
  const selectedId = input?.report_id ?? previews[0]?.id ?? null;
  const selectedReport = selectedId ? getReportById(selectedId) : null;
  const answerFlow = selectedReport ? getAnswerFlowByReportId(selectedReport.id) : null;
  const summaryCards = selectedReport
    ? listSummaryCardsByReportId(selectedReport.id, 8).map((card) => ({
        id: card.id,
        card_type: card.card_type,
        content: card.content,
        inclusion_score: card.inclusion_score,
        source_report_id: card.source_report_id,
        source_rule_id: card.source_rule_id,
      }))
    : [];
  const reviewQueue =
    selectedReport?.review_queue_id ? getQueueItem(selectedReport.review_queue_id) : null;

  return {
    inbox,
    reports: previews,
    selected_report: {
      report: selectedReport,
      answer_flow: answerFlow,
      summary_cards: summaryCards,
      review_queue: reviewQueue
        ? {
            review_queue_id: reviewQueue.id,
            next_review_at: reviewQueue.next_review_at,
            interval_days: reviewQueue.interval_days,
            repetitions: reviewQueue.repetitions,
            priority_score: reviewQueue.priority_score,
          }
        : null,
    },
    filters_applied: {
      mode: input?.mode ?? null,
      report_id: selectedId,
      limit,
    },
  };
}
