import { NextResponse } from "next/server";

import { ensureUpcomingCalendar } from "@/lib/server/calendar-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const daysRaw = Number.parseInt(url.searchParams.get("days") ?? "7", 10);
  const days = Number.isNaN(daysRaw) ? 7 : Math.min(Math.max(daysRaw, 1), 21);

  return NextResponse.json({
    calendar: ensureUpcomingCalendar(days),
  });
}
