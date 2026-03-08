import { NextResponse } from "next/server";

import { listRules } from "@/lib/server/report-store";

export async function GET() {
  return NextResponse.json({
    rules: listRules(),
  });
}
