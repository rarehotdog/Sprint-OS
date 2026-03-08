import type { DailyLog } from "@/lib/types";

interface DailyLogDb {
  logs: Map<string, DailyLog>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatDailyLogDb__: DailyLogDb | undefined;
}

function getDb(): DailyLogDb {
  if (!global.__gmatDailyLogDb__) {
    global.__gmatDailyLogDb__ = {
      logs: new Map<string, DailyLog>(),
    };
  }

  return global.__gmatDailyLogDb__;
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey() {
  return nowIso().slice(0, 10);
}

export function getTodayLog(): DailyLog | null {
  return getDb().logs.get(todayKey()) ?? null;
}

export function upsertTodayLog(partial: Partial<DailyLog> = {}): DailyLog {
  const key = todayKey();
  const current = getDb().logs.get(key);

  const next: DailyLog = {
    id: current?.id ?? crypto.randomUUID(),
    log_date: key,
    verbal_sprint_done: partial.verbal_sprint_done ?? current?.verbal_sprint_done ?? false,
    quant_di_sprint_done:
      partial.quant_di_sprint_done ?? current?.quant_di_sprint_done ?? false,
    error_reports_count:
      partial.error_reports_count ?? current?.error_reports_count ?? 0,
    deep_reports_count: partial.deep_reports_count ?? current?.deep_reports_count ?? 0,
    rule_of_day: partial.rule_of_day ?? current?.rule_of_day ?? null,
    top_error_cause: partial.top_error_cause ?? current?.top_error_cause ?? null,
    tomorrow_problems: partial.tomorrow_problems ?? current?.tomorrow_problems ?? [],
    notes: partial.notes ?? current?.notes ?? null,
    created_at: current?.created_at ?? nowIso(),
  };

  getDb().logs.set(key, next);
  return next;
}

export function resetDailyLogStoreForTests(): void {
  global.__gmatDailyLogDb__ = {
    logs: new Map<string, DailyLog>(),
  };
}
