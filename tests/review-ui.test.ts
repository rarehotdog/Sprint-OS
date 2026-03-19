import { describe, expect, it } from "vitest";

import {
  buildReviewReportsHref,
  getPreferredReportId,
  normalizeInboxActionHref,
  normalizeSummaryVersion,
} from "../src/lib/review-ui";
import type { ReviewInboxAction, ReviewReportsSnapshot } from "../src/lib/types";

function makeSnapshot(): ReviewReportsSnapshot {
  return {
    inbox: {
      counts: {
        total_reports: 2,
        pending_deep: 1,
        due_self_test: 0,
        recent_deep: 1,
        answer_flows: 1,
      },
      pending_deep: [],
      due_self_test: [],
      recent_deep: [],
      answer_flows: [],
      next_actions: [],
    },
    reports: [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        attempt_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        review_queue_id: null,
        report_mode: "quick",
        my_frame: "first",
        correct_mechanism: "first mechanism",
        next_tool: "first tool",
        error_type: null,
        created_at: new Date().toISOString(),
        deepened_at: null,
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        attempt_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        review_queue_id: null,
        report_mode: "deep",
        my_frame: "second",
        correct_mechanism: "second mechanism",
        next_tool: "second tool",
        error_type: null,
        created_at: new Date().toISOString(),
        deepened_at: new Date().toISOString(),
      },
    ],
    selected_report: {
      report: null,
      answer_flow: null,
      summary_cards: [],
      review_queue: null,
    },
    filters_applied: {
      mode: null,
      report_id: null,
      limit: 20,
    },
  };
}

describe("review ui helpers", () => {
  it("falls back to the first report id when selection is missing", () => {
    expect(getPreferredReportId(makeSnapshot(), null)).toBe(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
  });

  it("builds report hrefs without reintroducing legacy api composition", () => {
    expect(
      buildReviewReportsHref({
        mode: "deep",
        reportId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        limit: 10,
      }),
    ).toBe("/review/reports?mode=deep&report_id=cccccccc-cccc-cccc-cccc-cccccccccccc&limit=10");
  });

  it("normalizes inbox action routes to existing pages", () => {
    const deepenAction: ReviewInboxAction = {
      type: "deepen",
      label: "Deepen",
      href: "/review/deepen",
      count: 1,
    };

    expect(normalizeInboxActionHref(deepenAction)).toBe("/review/reports?mode=quick");
    expect(normalizeSummaryVersion("day")).toBe("day");
    expect(normalizeSummaryVersion("weird")).toBe("today");
  });
});
