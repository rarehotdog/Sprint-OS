import { create } from "zustand";

import type { SessionType, UUID } from "@/lib/types";

export type SolveLevel = 1 | 2 | 3;

interface SolveStoreState {
  sessionId: UUID | null;
  sessionType: SessionType | null;
  problemIds: UUID[];
  currentProblemIndex: number;
  level: SolveLevel;
  timeRemainingSec: number;
  isTimerRunning: boolean;
  preThinkCompleted: boolean;
  initializeSession: (params: {
    sessionId: UUID;
    sessionType: SessionType;
    problemIds: UUID[];
    durationSec: number;
    level: SolveLevel;
  }) => void;
  setCurrentProblemIndex: (index: number) => void;
  setPreThinkCompleted: (completed: boolean) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  tick: () => void;
  resetSolveState: () => void;
}

const initialState = {
  sessionId: null,
  sessionType: null,
  problemIds: [] as UUID[],
  currentProblemIndex: 0,
  level: 1 as SolveLevel,
  timeRemainingSec: 0,
  isTimerRunning: false,
  preThinkCompleted: false,
};

export const useSolveStore = create<SolveStoreState>((set) => ({
  ...initialState,
  initializeSession: ({ sessionId, sessionType, problemIds, durationSec, level }) =>
    set({
      sessionId,
      sessionType,
      problemIds,
      currentProblemIndex: 0,
      level,
      timeRemainingSec: durationSec,
      isTimerRunning: level !== 1,
      preThinkCompleted: false,
    }),
  setCurrentProblemIndex: (index) =>
    set({
      currentProblemIndex: index,
      preThinkCompleted: false,
    }),
  setPreThinkCompleted: (completed) => set({ preThinkCompleted: completed }),
  startTimer: () => set({ isTimerRunning: true }),
  pauseTimer: () => set({ isTimerRunning: false }),
  tick: () =>
    set((state) => ({
      timeRemainingSec:
        state.isTimerRunning && state.timeRemainingSec > 0
          ? state.timeRemainingSec - 1
          : state.timeRemainingSec,
    })),
  resetSolveState: () => set(initialState),
}));
