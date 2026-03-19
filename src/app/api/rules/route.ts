import { NextResponse } from "next/server";

import { ensureCanonicalStateLoaded } from "@/lib/server/persistence/repositories";
import { listRules } from "@/lib/server/report-store";

export async function GET() {
  await ensureCanonicalStateLoaded();
  return NextResponse.json({
    rules: listRules(),
  });
}
