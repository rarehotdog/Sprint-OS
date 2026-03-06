import { NextResponse } from "next/server";

import { createQuickReportSchema } from "@/lib/contracts/report-contracts";
import {
  createQuickReport,
  listPendingDeepReports,
  listReports,
} from "@/lib/server/report-store";

export async function GET() {
  return NextResponse.json({
    reports: listReports(),
    pending_deep: listPendingDeepReports(),
  });
}

export async function POST(request: Request) {
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

  const created = createQuickReport(parsed.data);

  return NextResponse.json(
    {
      report: created.report,
      created_rule: created.createdRule,
    },
    { status: 201 },
  );
}
