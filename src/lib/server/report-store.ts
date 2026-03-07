import type { AnalyzeReportOutput, CreateQuickReportInput, DeepenReportInput } from "@/lib/contracts/report-contracts";
import type { ErrorReport, Rule } from "@/lib/types";
import { resetQueueStoreForTests, seedQueueItem } from "@/lib/server/review-queue-store";
import { getAttemptById } from "@/lib/server/solve-store";

interface MemoryDb {
  reports: Map<string, ErrorReport>;
  rules: Rule[];
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatMemoryDb__: MemoryDb | undefined;
}

function getMemoryDb(): MemoryDb {
  if (!global.__gmatMemoryDb__) {
    global.__gmatMemoryDb__ = {
      reports: new Map<string, ErrorReport>(),
      rules: [],
    };
  }

  return global.__gmatMemoryDb__;
}

function now(): string {
  return new Date().toISOString();
}

export function listReports(): ErrorReport[] {
  return Array.from(getMemoryDb().reports.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export function listPendingDeepReports(): ErrorReport[] {
  return listReports().filter(
    (report) => report.report_mode === "quick" && report.deepened_at === null,
  );
}

export function createQuickReport(input: CreateQuickReportInput): {
  report: ErrorReport;
  createdRule: Rule | null;
} {
  const timestamp = now();
  const reviewQueueId = crypto.randomUUID();
  const report: ErrorReport = {
    id: crypto.randomUUID(),
    attempt_id: input.attempt_id,
    review_queue_id: reviewQueueId,
    report_mode: "quick",
    my_frame: input.my_frame,
    correct_mechanism: input.correct_mechanism,
    next_tool: input.next_tool,
    mechanism_english: null,
    logic_comparison: null,
    sub_report: null,
    failure_stage: input.failure_stage,
    error_type: input.error_type,
    ai_wrong_choices: null,
    ai_core_principle: null,
    ai_emotional_diary: null,
    ai_visual_concept: null,
    created_at: timestamp,
    deepened_at: null,
  };

  const db = getMemoryDb();
  db.reports.set(report.id, report);
  const sourceAttempt = getAttemptById(input.attempt_id);
  seedQueueItem({
    id: reviewQueueId,
    problem_id: sourceAttempt?.problem_id ?? crypto.randomUUID(),
    next_review_at: timestamp,
    interval_days: 1,
    ease_factor: 2.5,
    repetitions: 0,
    priority_score: 1,
    created_at: timestamp,
  });

  if (!input.save_as_rule) {
    return { report, createdRule: null };
  }

  const rule: Rule = {
    id: crypto.randomUUID(),
    content: report.next_tool,
    section: null,
    source_report_id: report.id,
    is_top20: false,
    created_at: timestamp,
  };

  db.rules.push(rule);

  return { report, createdRule: rule };
}

export function deepenReport(input: DeepenReportInput): ErrorReport {
  const db = getMemoryDb();
  const found = db.reports.get(input.report_id);

  if (!found) {
    throw new Error("Report not found");
  }

  if (found.report_mode !== "quick") {
    throw new Error("Report is already deepened");
  }

  const deepened: ErrorReport = {
    ...found,
    report_mode: "deep",
    mechanism_english: input.mechanism_english,
    logic_comparison: input.logic_comparison,
    sub_report: input.sub_report ?? null,
    deepened_at: now(),
  };

  db.reports.set(deepened.id, deepened);
  return deepened;
}

export function attachAiAnalysis(
  reportId: string,
  analysis: AnalyzeReportOutput,
): ErrorReport {
  const db = getMemoryDb();
  const found = db.reports.get(reportId);

  if (!found) {
    throw new Error("Report not found");
  }

  const updated: ErrorReport = {
    ...found,
    ai_wrong_choices: analysis.wrong_choices,
    ai_core_principle: analysis.core_principle,
    ai_emotional_diary: analysis.emotional_diary,
    ai_visual_concept: analysis.visual_concept,
  };

  db.reports.set(reportId, updated);
  return updated;
}

export function resetReportStoreForTests(): void {
  global.__gmatMemoryDb__ = {
    reports: new Map<string, ErrorReport>(),
    rules: [],
  };
  resetQueueStoreForTests();
}
