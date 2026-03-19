import type {
  AnalyzeReportResponse,
  Attempt,
  DeepenReportRequest,
  DeepenReportResponse,
  FailureStage,
  Problem,
  Section,
  SelfTestRecall,
  SessionDetailResponse,
  SessionRunState,
} from "@/lib/types";
import { buildProblemsWorkbenchHref } from "@/lib/problems-ui";

type SearchParamReader = {
  get(name: string): string | null;
};

export interface SolveQueryFallbacks {
  questionNumber: number | null;
  section: Section | null;
  durationMinutes: number | null;
}

export interface SolveRecoverySnapshot {
  orderedProblems: Problem[];
  activeIndex: number;
  activeProblem: Problem | null;
  activeProblemId: string | null;
  currentSection: Section | null;
  durationMinutes: number | null;
  questionNumber: number | null;
  totalCount: number;
}

export interface SolveEmptyState {
  title: string;
  description: string;
  section: Section | null;
  problemsHref: string;
}

export interface SolveSubmissionResolution {
  isCorrect: boolean | null;
  error: string | null;
}

export interface QuickReportDraft {
  my_frame: string;
  correct_mechanism: string;
  next_tool: string;
  failure_stage: FailureStage;
  error_type: string;
  save_as_rule: boolean;
}

export interface MicroQuickOption {
  value: string;
  label: string;
}

export interface MicroQuickFormState {
  error_type: string;
  next_tool: string;
  one_line_note: string;
}

export interface ConceptSupportCard {
  mechanism: string;
  frame_shift: string;
  checkpoint: string;
}

export const MICRO_QUICK_ERROR_TYPE_OPTIONS: MicroQuickOption[] = [
  { value: "misread_prompt", label: "질문 오독" },
  { value: "scope_drift", label: "범위 이탈" },
  { value: "careless_check", label: "검산 누락" },
  { value: "premature_lock", label: "성급한 선택" },
  { value: "time_panic", label: "시간 압박" },
];

export const MICRO_QUICK_NEXT_TOOL_OPTIONS: MicroQuickOption[] = [
  { value: "restate_question", label: "질문 재서술" },
  { value: "lock_condition", label: "조건 먼저 고정" },
  { value: "check_core_assumption", label: "핵심 가정 점검" },
  { value: "verify_unit_axis", label: "단위/축 확인" },
  { value: "final_verification", label: "마지막 검산" },
];

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseSection(value: string | null): Section | null {
  if (value === "verbal" || value === "quant" || value === "di") {
    return value;
  }

  return null;
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= total) {
    return total - 1;
  }

  return index;
}

function buildOrderedProblems(orderedProblemIds: string[], problems: Problem[]): Problem[] {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));

  return orderedProblemIds
    .map((problemId) => byId.get(problemId) ?? null)
    .filter((problem): problem is Problem => problem !== null);
}

function resolveSectionForIndex(
  detail: SessionDetailResponse,
  activeIndex: number,
  fallbackSection: Section | null,
): Section | null {
  const match = detail.solve_context.section_bounds.find(
    (bound) => activeIndex >= bound.start_index && activeIndex < bound.end_index,
  );

  return match?.section ?? detail.solve_context.section_hint ?? fallbackSection;
}

export function parseSolveQueryFallbacks(searchParams: SearchParamReader): SolveQueryFallbacks {
  return {
    questionNumber: parsePositiveInt(searchParams.get("q")),
    section: parseSection(searchParams.get("section")),
    durationMinutes: parsePositiveInt(searchParams.get("duration")),
  };
}

export function buildSolveRecoverySnapshot(
  detail: SessionDetailResponse,
  problems: Problem[],
  fallbacks: SolveQueryFallbacks,
): SolveRecoverySnapshot {
  const orderedProblems = buildOrderedProblems(detail.run_state.ordered_problem_ids, problems);
  const totalCount = detail.run_state.total_count || orderedProblems.length;
  const activeIndex = clampIndex(detail.run_state.current_index, totalCount);
  const activeProblem = orderedProblems[activeIndex] ?? null;
  const activeProblemId =
    activeProblem?.id ??
    detail.run_state.ordered_problem_ids[activeIndex] ??
    detail.run_state.next_problem_id;

  return {
    orderedProblems,
    activeIndex,
    activeProblem,
    activeProblemId,
    currentSection: resolveSectionForIndex(detail, activeIndex, fallbacks.section),
    durationMinutes: detail.solve_context.duration_planned_min ?? fallbacks.durationMinutes,
    questionNumber: activeProblem ? activeIndex + 1 : fallbacks.questionNumber,
    totalCount,
  };
}

export function getSolveReviewDestination(sessionId: string, runState: SessionRunState): {
  href: string;
  label: string;
  description: string;
} {
  if (runState.completed) {
    return {
      href: "/summary?version=today",
      label: "세션 요약집 보기",
      description: "run_state.completed=true 기준으로 오늘 요약집으로 이동합니다.",
    };
  }

  return {
    href: `/solve/${sessionId}`,
    label: "다음 문제로 복귀",
    description: "run_state.current_index와 next_problem_id 기준으로 같은 위치를 복구합니다.",
  };
}

function getSectionCheckSentence(section: Section | null): string {
  if (section === "quant") {
    return "다음에는 식, 단위, 분모를 먼저 적고 계산에 들어간다.";
  }

  if (section === "di") {
    return "다음에는 표 구조, 축, 단위를 먼저 확인하고 숫자를 비교한다.";
  }

  return "다음에는 질문 요구와 핵심 근거를 한 줄로 먼저 고정한다.";
}

function inferFailureStage(attempt: Attempt): FailureStage {
  if (attempt.exceeded_cutoff || attempt.time_spent_sec >= 180) {
    return "time_pressure";
  }

  return "strategy";
}

export function buildQuickReportDraft(
  attempt: Attempt,
  problem: Problem | null,
): QuickReportDraft {
  const section = problem?.section ?? null;
  const subType = problem?.sub_type ?? "this question";
  const result = attempt.is_correct ? "맞혔지만" : "틀렸고";

  return {
    my_frame: `나는 ${subType} 문제를 이렇게 봤고, ${result} 어떤 기준을 먼저 잡았는지 복기한다.`,
    correct_mechanism: `정답은 이 문제에서 무엇을 먼저 비교하거나 고정해야 했는지 한 문장으로 적는다.`,
    next_tool: getSectionCheckSentence(section),
    failure_stage: inferFailureStage(attempt),
    error_type: "",
    save_as_rule: false,
  };
}

export function buildMicroQuickDraft(
  attempt: Attempt,
  problem: Problem | null,
): MicroQuickFormState {
  const defaultTool =
    MICRO_QUICK_NEXT_TOOL_OPTIONS.find((option) =>
      buildQuickReportDraft(attempt, problem).next_tool.includes(option.label.slice(0, 2)),
    )?.value ?? MICRO_QUICK_NEXT_TOOL_OPTIONS[0]?.value ?? "";

  return {
    error_type: attempt.is_correct ? "premature_lock" : "scope_drift",
    next_tool: defaultTool,
    one_line_note: `${problem?.sub_type ?? "이번 문제"}에서 놓친 체크 포인트를 한 줄로 남긴다.`,
  };
}

function getNextToolLabel(value: string): string {
  return (
    MICRO_QUICK_NEXT_TOOL_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

export function buildQuickReportPayload(input: {
  attempt: Attempt;
  problem: Problem | null;
  microQuick: MicroQuickFormState;
}): QuickReportDraft {
  const base = buildQuickReportDraft(input.attempt, input.problem);
  const note = input.microQuick.one_line_note.trim();

  return {
    ...base,
    my_frame: note ? note : base.my_frame,
    next_tool: getNextToolLabel(input.microQuick.next_tool),
    error_type: input.microQuick.error_type,
  };
}

export function shouldAutoDeepenAttempt(attempt: Attempt): boolean {
  return (
    !attempt.is_correct ||
    attempt.exceeded_cutoff ||
    attempt.confidence === "unsure" ||
    attempt.confidence === "guessed"
  );
}

export function mapAttemptToRecall(attempt: Attempt): SelfTestRecall {
  if (!attempt.is_correct || attempt.confidence === "guessed") {
    return "no_recall";
  }

  if (attempt.confidence === "unsure" || attempt.exceeded_cutoff) {
    return "uncertain";
  }

  return "complete_recall";
}

function buildMechanismSentence(problem: Problem | null): string {
  if (problem?.section === "quant") {
    return "Lock the variables, units, and target relationship before calculation.";
  }

  if (problem?.section === "di") {
    return "Read the table structure, axis, and unit before comparing values.";
  }

  return "Restate the exact question task and link each choice back to that task.";
}

export function buildAutoDeepenPayload(input: {
  report_id: string;
  attempt: Attempt;
  problem: Problem | null;
  quickReport: QuickReportDraft;
}): DeepenReportRequest {
  const resultLine = input.attempt.is_correct
    ? "The answer was correct, but the process still needs to be made repeatable."
    : "The first frame drifted away from the signal that actually decides the answer.";

  return {
    report_id: input.report_id,
    mechanism_english: buildMechanismSentence(input.problem),
    logic_comparison: `${resultLine} Next time, ${input.quickReport.next_tool}.`,
    generate_ai: true,
  };
}

export function buildConceptSupportCard(
  response: DeepenReportResponse | null,
  quickReport: QuickReportDraft,
): ConceptSupportCard | null {
  if (!response?.report) {
    return null;
  }

  const aiAnalysis: AnalyzeReportResponse | null = response.ai_analysis ?? null;

  return {
    mechanism: aiAnalysis?.core_principle ?? response.report.mechanism_english ?? quickReport.correct_mechanism,
    frame_shift: aiAnalysis?.wrong_choices ?? response.report.logic_comparison ?? quickReport.my_frame,
    checkpoint:
      aiAnalysis?.visual_concept ?? response.report.next_tool ?? quickReport.next_tool,
  };
}

export function resolveSolveSubmission(input: {
  answerIndex: number | null;
  selectedAnswer: number | null;
  selfReportedCorrect: boolean | null;
}): SolveSubmissionResolution {
  if (input.answerIndex !== null) {
    if (input.selectedAnswer === null) {
      return {
        isCorrect: null,
        error: "정답 선지를 선택해야 제출할 수 있습니다.",
      };
    }

    return {
      isCorrect: input.selectedAnswer === input.answerIndex,
      error: null,
    };
  }

  if (input.selfReportedCorrect === null) {
    return {
      isCorrect: null,
      error: "정답 여부를 먼저 선택해야 제출할 수 있습니다.",
    };
  }

  return {
    isCorrect: input.selfReportedCorrect,
    error: null,
  };
}

export function getSolveEmptyState(detail: SessionDetailResponse | null): SolveEmptyState | null {
  if (!detail) {
    return null;
  }

  if (detail.run_state.total_count > 0 || detail.run_state.ordered_problem_ids.length > 0) {
    return null;
  }

  const section = detail.solve_context.section_hint;

  return {
    title: "문제 세트가 아직 준비되지 않았습니다.",
    description:
      "이 세션에는 ordered_problem_ids가 없습니다. Today Hub로 돌아가거나 문제 준비 화면에서 starter 세트를 만든 뒤 다시 시작하세요.",
    section,
    problemsHref: buildProblemsWorkbenchHref(section),
  };
}
