import type { ReviewInboxAction, ReviewReportsSnapshot, SummaryVersion } from "@/lib/types";

export type ReviewMode = "quick" | "deep" | null;

export function normalizeReviewMode(value: string | null): ReviewMode {
  if (value === "quick" || value === "deep") {
    return value;
  }

  return null;
}

export function parseReviewLimit(value: string | null): number {
  if (!value) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }

  return Math.min(parsed, 100);
}

export function buildReviewReportsHref(params: {
  mode?: ReviewMode;
  reportId?: string | null;
  limit?: number;
}): string {
  const searchParams = new URLSearchParams();

  if (params.mode) {
    searchParams.set("mode", params.mode);
  }

  if (params.reportId) {
    searchParams.set("report_id", params.reportId);
  }

  if (params.limit && params.limit !== 20) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  return query ? `/review/reports?${query}` : "/review/reports";
}

export function getPreferredReportId(
  snapshot: ReviewReportsSnapshot,
  requestedReportId: string | null,
): string | null {
  if (snapshot.selected_report.report?.id) {
    return snapshot.selected_report.report.id;
  }

  if (requestedReportId && snapshot.reports.some((report) => report.id === requestedReportId)) {
    return requestedReportId;
  }

  return snapshot.reports[0]?.id ?? null;
}

export function normalizeInboxActionHref(action: ReviewInboxAction): string {
  if (action.type === "deepen") {
    return buildReviewReportsHref({ mode: "quick" });
  }

  if (action.type === "self_test") {
    return buildReviewReportsHref({ mode: "deep" });
  }

  return "/summary?version=today";
}

export function normalizeSummaryVersion(value: string | null): SummaryVersion {
  if (value === "eve" || value === "day") {
    return value;
  }

  return "today";
}
