import type { CalendarDay } from "@/lib/types";

interface CalendarDb {
  days: Map<string, CalendarDay>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatCalendarDb__: CalendarDb | undefined;
}

function getDb(): CalendarDb {
  if (!global.__gmatCalendarDb__) {
    global.__gmatCalendarDb__ = {
      days: new Map<string, CalendarDay>(),
    };
  }

  return global.__gmatCalendarDb__;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ensureUpcomingCalendar(days = 7): CalendarDay[] {
  const db = getDb();
  const today = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const key = toDateKey(date);

    if (!db.days.has(key)) {
      db.days.set(key, {
        id: crypto.randomUUID(),
        cal_date: key,
        week_number: Math.min(4, Math.floor(offset / 7) + 1),
        intensity_level: offset === 0 ? 2 : 1,
        planned_verbal: offset % 2 === 0 ? "CR/RC mixed sprint" : "RC review sprint",
        planned_main: offset % 3 === 0 ? "Deep review + summary update" : "Quant/DI review",
        is_mock_day: offset === 5,
        is_rest_day: offset === 6,
        completed: false,
        actual_notes: null,
      });
    }
  }

  return [...db.days.values()]
    .sort((a, b) => a.cal_date.localeCompare(b.cal_date))
    .slice(0, days);
}

export function resetCalendarStoreForTests(): void {
  global.__gmatCalendarDb__ = {
    days: new Map<string, CalendarDay>(),
  };
}
