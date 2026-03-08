import { NextResponse } from "next/server";

import { upsertTodayLog } from "@/lib/server/daily-log-store";
import { listRules, listReports } from "@/lib/server/report-store";
import { listAttempts } from "@/lib/server/solve-store";

export async function GET() {
  const attempts = listAttempts();
  const reports = listReports();
  const rules = listRules();
  const today = new Date().toISOString().slice(0, 10);

  const attemptsToday = attempts.filter((attempt) => attempt.attempted_at.slice(0, 10) === today);
  const reportsToday = reports.filter((report) => report.created_at.slice(0, 10) === today);
  const deepToday = reportsToday.filter((report) => report.report_mode === "deep");

  const errorCounts = new Map<string, number>();
  for (const report of reportsToday) {
    if (!report.error_type) continue;
    errorCounts.set(report.error_type, (errorCounts.get(report.error_type) ?? 0) + 1);
  }

  const topErrorCause =
    [...errorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const todayLog = upsertTodayLog({
    verbal_sprint_done: attemptsToday.some((attempt) => attempt.time_spent_sec >= 1),
    quant_di_sprint_done: attemptsToday.length >= 2,
    error_reports_count: reportsToday.length,
    deep_reports_count: deepToday.length,
    rule_of_day: rules[0]?.content ?? null,
    top_error_cause: topErrorCause,
    tomorrow_problems: attemptsToday.slice(0, 5).map((attempt) => attempt.problem_id),
  });

  const message =
    attemptsToday.length === 0
      ? "오늘은 아직 풀이 기록이 없습니다. 최소 1세트라도 풀고 Quick 리포트를 남기면 요약집이 더 강해집니다."
      : `오늘 ${attemptsToday.length}문항을 풀었고 Quick/Deep 리포트는 ${reportsToday.length}개입니다. 가장 많이 반복된 실수는 ${
          topErrorCause ?? "아직 집계 전"
        }입니다.`;

  return NextResponse.json({
    summary: message,
    today_log: todayLog,
  });
}
