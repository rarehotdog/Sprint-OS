import { NextResponse } from "next/server";

import { createQuickReportSchema } from "@/lib/contracts/report-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET(request: Request) {
  const repositories = await getServerRepositories();
  const url = new URL(request.url);
  const reportId = url.searchParams.get("report_id");
  const mode = url.searchParams.get("mode");
  const limitRaw = url.searchParams.get("limit");

  if (reportId) {
    const report = await repositories.reports.getReportById(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ report });
  }

  let reports = await repositories.reports.listReports();
  if (mode === "quick" || mode === "deep") {
    reports = reports.filter((report) => report.report_mode === mode);
  }

  if (limitRaw) {
    const limit = Number.parseInt(limitRaw, 10);
    if (!Number.isNaN(limit) && limit > 0) {
      reports = reports.slice(0, limit);
    }
  }

  return NextResponse.json({
    reports,
    pending_deep: await repositories.reports.listPendingDeepReports(),
  });
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = createQuickReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid quick report payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const created = await repositories.reports.createQuickReport(parsed.data);

  return NextResponse.json(
    {
      report: created.report,
      created_rule: created.createdRule,
    },
    { status: 201 },
  );
}
