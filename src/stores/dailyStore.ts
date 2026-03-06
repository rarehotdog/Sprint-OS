import { create } from "zustand";

import type { CalendarDay, DailyLog } from "@/lib/types";

interface DailyStoreState {
  todayLog: DailyLog | null;
  calendar: CalendarDay[];
  setTodayLog: (log: DailyLog | null) => void;
  setCalendar: (calendar: CalendarDay[]) => void;
  markCalendarDayComplete: (calDate: string, actualNotes?: string) => void;
  clear: () => void;
}

const initialState = {
  todayLog: null as DailyLog | null,
  calendar: [] as CalendarDay[],
};

export const useDailyStore = create<DailyStoreState>((set) => ({
  ...initialState,
  setTodayLog: (log) => set({ todayLog: log }),
  setCalendar: (calendar) => set({ calendar }),
  markCalendarDayComplete: (calDate, actualNotes) =>
    set((state) => ({
      calendar: state.calendar.map((day) =>
        day.cal_date === calDate
          ? {
              ...day,
              completed: true,
              actual_notes: actualNotes ?? day.actual_notes,
            }
          : day,
      ),
    })),
  clear: () => set(initialState),
}));
