import { create } from "zustand";

import type { ErrorReport, ReviewQueueItem, UUID } from "@/lib/types";

interface ReviewStoreState {
  pendingReports: ErrorReport[];
  pendingDeep: UUID[];
  reviewQueue: ReviewQueueItem[];
  setPendingReports: (reports: ErrorReport[]) => void;
  setReviewQueue: (queue: ReviewQueueItem[]) => void;
  upsertReport: (report: ErrorReport) => void;
  clear: () => void;
}

const initialState = {
  pendingReports: [] as ErrorReport[],
  pendingDeep: [] as UUID[],
  reviewQueue: [] as ReviewQueueItem[],
};

export const useReviewStore = create<ReviewStoreState>((set) => ({
  ...initialState,
  setPendingReports: (reports) =>
    set({
      pendingReports: reports,
      pendingDeep: reports
        .filter(
          (report) => report.report_mode === "quick" && report.deepened_at === null,
        )
        .map((report) => report.id),
    }),
  setReviewQueue: (queue) => set({ reviewQueue: queue }),
  upsertReport: (report) =>
    set((state) => {
      const others = state.pendingReports.filter((item) => item.id !== report.id);
      const nextReports = [report, ...others];
      return {
        pendingReports: nextReports,
        pendingDeep: nextReports
          .filter(
            (item) => item.report_mode === "quick" && item.deepened_at === null,
          )
          .map((item) => item.id),
      };
    }),
  clear: () => set(initialState),
}));
