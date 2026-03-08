import { NextResponse } from "next/server";

import {
  weaknessDashboardResponseSchema,
  weaknessQuerySchema,
} from "@/lib/contracts/dashboard-contracts";
import { getWeaknessAnalytics } from "@/lib/server/weakness-analytics";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const daysRaw = url.searchParams.get("days") ?? undefined;
  const sectionRaw = url.searchParams.get("section") ?? undefined;
  const sourceRaw = url.searchParams.get("source") ?? undefined;

  const parsed = weaknessQuerySchema.safeParse({
    days: daysRaw,
    section: sectionRaw && sectionRaw.length > 0 ? sectionRaw : undefined,
    source: sourceRaw && sourceRaw.length > 0 ? sourceRaw : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid weakness query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const analytics = getWeaknessAnalytics(parsed.data);
  const strict = weaknessDashboardResponseSchema.parse(analytics);

  return NextResponse.json(strict);
}
