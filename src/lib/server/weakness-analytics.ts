import type { Section, WeaknessDashboardResponse } from "@/lib/types";

import type { WeaknessQueryInput } from "@/lib/contracts/dashboard-contracts";
import { listProblems } from "@/lib/server/problems-store";
import { listReports } from "@/lib/server/report-store";
import { listAttempts } from "@/lib/server/solve-store";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  total: number;
  correct: number;
  cutoffExceeded: number;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildDateWindow(days: number, end: Date): string[] {
  const values: string[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(end.getTime() - index * DAY_MS);
    values.push(date.toISOString().slice(0, 10));
  }

  return values;
}

export function getWeaknessAnalytics(filters: WeaknessQueryInput): WeaknessDashboardResponse {
  const now = new Date();
  const windowStart = new Date(now.getTime() - Math.max(filters.days - 1, 0) * DAY_MS);

  const problems = listProblems();
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));

  const attemptsInWindow = listAttempts().filter((attempt) => {
    const attemptedAt = new Date(attempt.attempted_at);
    if (Number.isNaN(attemptedAt.getTime()) || attemptedAt < windowStart) {
      return false;
    }

    const problem = problemById.get(attempt.problem_id);
    if (!problem) {
      return false;
    }

    if (filters.section && problem.section !== filters.section) {
      return false;
    }

    if (filters.source && problem.source !== filters.source) {
      return false;
    }

    return true;
  });

  const attemptIds = new Set(attemptsInWindow.map((attempt) => attempt.id));

  const reports = listReports().filter((report) => attemptIds.has(report.attempt_id));
  const sourceCounts = new Map<string, number>();

  for (const problem of problems) {
    const sourceKey = problem.source ?? "unknown";
    sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);
  }

  const sectionBuckets = new Map<Section, Bucket>();
  const subtypeBuckets = new Map<string, Bucket & { section: Section; sub_type: string }>();

  for (const attempt of attemptsInWindow) {
    const problem = problemById.get(attempt.problem_id);
    if (!problem) {
      continue;
    }

    const sectionBucket = sectionBuckets.get(problem.section) ?? {
      total: 0,
      correct: 0,
      cutoffExceeded: 0,
    };

    sectionBucket.total += 1;
    sectionBucket.correct += attempt.is_correct ? 1 : 0;
    sectionBucket.cutoffExceeded += attempt.exceeded_cutoff ? 1 : 0;
    sectionBuckets.set(problem.section, sectionBucket);

    const subtypeKey = `${problem.section}::${problem.sub_type}`;
    const subtypeBucket = subtypeBuckets.get(subtypeKey) ?? {
      section: problem.section,
      sub_type: problem.sub_type,
      total: 0,
      correct: 0,
      cutoffExceeded: 0,
    };

    subtypeBucket.total += 1;
    subtypeBucket.correct += attempt.is_correct ? 1 : 0;
    subtypeBucket.cutoffExceeded += attempt.exceeded_cutoff ? 1 : 0;
    subtypeBuckets.set(subtypeKey, subtypeBucket);
  }

  const section_accuracy = (["verbal", "quant", "di"] as Section[])
    .map((section) => {
      const bucket = sectionBuckets.get(section);
      if (!bucket) {
        return null;
      }

      return {
        section,
        total: bucket.total,
        correct: bucket.correct,
        accuracy: ratio(bucket.correct, bucket.total),
        cutoff_exceeded_rate: ratio(bucket.cutoffExceeded, bucket.total),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const subtype_weakness = Array.from(subtypeBuckets.values())
    .map((bucket) => ({
      section: bucket.section,
      sub_type: bucket.sub_type,
      total: bucket.total,
      incorrect: bucket.total - bucket.correct,
      accuracy: ratio(bucket.correct, bucket.total),
      cutoff_exceeded_rate: ratio(bucket.cutoffExceeded, bucket.total),
    }))
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) {
        return a.accuracy - b.accuracy;
      }
      return b.total - a.total;
    });

  const attemptById = new Map(attemptsInWindow.map((attempt) => [attempt.id, attempt]));
  const errorCountBySection = new Map<Section, number>();
  const distributionBuckets = new Map<
    string,
    {
      section: Section;
      failure_stage: string;
      error_type: string;
      count: number;
    }
  >();

  for (const report of reports) {
    const attempt = attemptById.get(report.attempt_id);
    if (!attempt) {
      continue;
    }

    const problem = problemById.get(attempt.problem_id);
    if (!problem) {
      continue;
    }

    const failureStage = report.failure_stage ?? "unclassified";
    const errorType = report.error_type ?? "unknown";
    const key = `${problem.section}::${failureStage}::${errorType}`;

    const bucket = distributionBuckets.get(key) ?? {
      section: problem.section,
      failure_stage: failureStage,
      error_type: errorType,
      count: 0,
    };

    bucket.count += 1;
    distributionBuckets.set(key, bucket);

    errorCountBySection.set(
      problem.section,
      (errorCountBySection.get(problem.section) ?? 0) + 1,
    );
  }

  const error_distribution = Array.from(distributionBuckets.values())
    .map((bucket) => ({
      ...bucket,
      ratio: ratio(bucket.count, errorCountBySection.get(bucket.section) ?? 0),
    }))
    .sort((a, b) => b.count - a.count);

  const trendAttempts = new Map<
    string,
    {
      total_attempts: number;
      correct_attempts: number;
    }
  >();

  for (const attempt of attemptsInWindow) {
    const key = toDateKey(attempt.attempted_at);
    const bucket = trendAttempts.get(key) ?? { total_attempts: 0, correct_attempts: 0 };
    bucket.total_attempts += 1;
    bucket.correct_attempts += attempt.is_correct ? 1 : 0;
    trendAttempts.set(key, bucket);
  }

  const trendReports = new Map<string, number>();
  for (const report of reports) {
    const attempt = attemptById.get(report.attempt_id);
    if (!attempt) {
      continue;
    }

    const key = toDateKey(attempt.attempted_at);
    trendReports.set(key, (trendReports.get(key) ?? 0) + 1);
  }

  const trend = buildDateWindow(filters.days, now).map((date) => {
    const attempts = trendAttempts.get(date) ?? { total_attempts: 0, correct_attempts: 0 };
    return {
      date,
      total_attempts: attempts.total_attempts,
      correct_attempts: attempts.correct_attempts,
      accuracy: ratio(attempts.correct_attempts, attempts.total_attempts),
      error_reports: trendReports.get(date) ?? 0,
    };
  });

  const totalAttempts = attemptsInWindow.length;
  const correctAttempts = attemptsInWindow.filter((attempt) => attempt.is_correct).length;
  const cutoffExceeded = attemptsInWindow.filter((attempt) => attempt.exceeded_cutoff).length;

  return {
    summary: {
      window_days: filters.days,
      total_attempts: totalAttempts,
      total_reports: reports.length,
      accuracy: ratio(correctAttempts, totalAttempts),
      cutoff_exceeded_rate: ratio(cutoffExceeded, totalAttempts),
    },
    section_accuracy,
    subtype_weakness,
    error_distribution,
    trend,
    source_distribution: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    totals: {
      problems: problems.length,
      reports: reports.length,
    },
    filters_applied: {
      days: filters.days,
      section: filters.section ?? null,
      source: filters.source ?? null,
    },
  };
}
