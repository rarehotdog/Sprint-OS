import { buildProblemsWorkbenchHref } from "@/lib/problems-ui";
import type {
  DailyCheckin,
  DailyPlan,
  DailyPlanBlock,
  DailyPlanBlockStatus,
  Section,
  SummarySubType,
  TodayNextAction,
  TodayQueueCounts,
  TodayQueueItem,
  TodaySnapshot,
  TodayStartRequest,
} from "@/lib/types";

export interface TodayTopTaskCard {
  id: string;
  title: string;
  description: string;
  block_type: DailyPlanBlock["block_type"] | "preview";
  status: DailyPlanBlockStatus | "preview";
  minutes: number | null;
  section: Section | null;
  is_current: boolean;
}

export interface TodayWarmupPracticeCard {
  id: string;
  title: string;
  ask: string;
  key_factor: string;
  check: string;
  source: string;
}

export interface TodayPrimaryAction {
  kind:
    | "start_day"
    | "solve"
    | "solve_blocked"
    | "review_route"
    | "warmup_inline"
    | "consolidation_route"
    | "consolidation_blocked"
    | "booklet_route";
  label: string;
  href: string | null;
  description: string;
}

export interface TodayQueuePrimaryAction {
  kind: "prepare" | "start" | "resume" | "completed";
  label: string;
  href: string | null;
  description: string;
}

export const DEFAULT_TODAY_START_CHECKIN: TodayStartRequest["checkin"] = {
  energy: 3,
  focus: 3,
  stress: 3,
  sleep_quality: 3,
  confidence: 3,
  available_minutes: 120,
};

const TODAY_PREVIEW_TASKS: TodayTopTaskCard[] = [
  {
    id: "preview-warmup-review",
    title: "Warmup Review",
    description: "due review와 약점 흐름을 먼저 훑고 감을 올립니다.",
    block_type: "preview",
    status: "preview",
    minutes: null,
    section: null,
    is_current: true,
  },
  {
    id: "preview-main-solve",
    title: "Main Solve",
    description: "오늘 메인 섹션 스프린트를 시작하고 같은 위치로 계속 복구합니다.",
    block_type: "preview",
    status: "preview",
    minutes: null,
    section: null,
    is_current: false,
  },
  {
    id: "preview-consolidation",
    title: "Consolidation",
    description: "quick review를 정리하고 오늘 요약집으로 반영할 재료를 남깁니다.",
    block_type: "preview",
    status: "preview",
    minutes: null,
    section: null,
    is_current: false,
  },
];

function formatSectionLabel(section: Section | null): string {
  if (section === "verbal") return "Verbal";
  if (section === "quant") return "Quant";
  if (section === "di") return "DI";
  return "GMAT";
}

function getSectionWarmupTemplate(section: Section | null): {
  ask: string;
  key_factor: string;
  check: string;
} {
  if (section === "quant") {
    return {
      ask: "지금 먼저 적어야 하는 식, 단위, 분모는 무엇인가?",
      key_factor: "식을 늦게 세우지 말고 변수와 기준값을 먼저 적는다.",
      check: "계산 전에 단위와 분모가 맞는지 한 번 더 확인한다.",
    };
  }

  if (section === "di") {
    return {
      ask: "표/그래프에서 정말 비교해야 하는 축과 단위는 무엇인가?",
      key_factor: "보기 전에 표 구조와 기준 단위를 먼저 읽는다.",
      check: "숫자를 고르기 전에 축, 단위, 범례를 다시 확인한다.",
    };
  }

  return {
    ask: "이 문제가 정말 묻는 결론/주장/역할은 무엇인가?",
    key_factor: "선지 전에 질문 요구와 핵심 근거를 한 줄로 고정한다.",
    check: "매력적인 선지가 아니라 질문 요구와 직접 연결되는지 확인한다.",
  };
}

export function getCurrentPlanBlock(plan: DailyPlan | null): DailyPlanBlock | null {
  if (!plan) {
    return null;
  }

  return (
    plan.blocks.find((block) => block.status === "in_progress") ??
    plan.blocks.find((block) => block.status === "pending") ??
    null
  );
}

export function getPlannedSolveSection(plan: DailyPlan | null): Section | null {
  if (!plan) {
    return null;
  }

  const activeMainBlock = plan.blocks.find(
    (block) => block.block_type === "main_block" && block.status !== "completed",
  );

  if (activeMainBlock?.section_hint) {
    return activeMainBlock.section_hint;
  }

  return plan.blocks.find((block) => block.block_type === "main_block")?.section_hint ?? null;
}

function getTopTaskDescription(block: DailyPlanBlock): string {
  if (block.block_type === "warmup_review") {
    return "due review와 약점 복습으로 메인 블록 전 감을 맞춥니다.";
  }

  if (block.block_type === "main_block") {
    return block.section_hint
      ? `${block.section_hint} 메인 스프린트를 이어갑니다.`
      : "오늘 메인 스프린트를 이어갑니다.";
  }

  if (block.block_type === "consolidation") {
    return "quick review, deep 확장, 회고를 정리합니다.";
  }

  return "오늘 summary booklet에 넣을 핵심만 다시 압축합니다.";
}

export function getTodayTopTaskCards(plan: DailyPlan | null): TodayTopTaskCard[] {
  if (!plan || plan.blocks.length === 0) {
    return TODAY_PREVIEW_TASKS;
  }

  const currentBlock = getCurrentPlanBlock(plan);
  const currentIndex = currentBlock
    ? plan.blocks.findIndex((block) => block.id === currentBlock.id)
    : -1;

  const visibleBlocks =
    currentIndex === -1
      ? plan.blocks.slice(Math.max(0, plan.blocks.length - 3))
      : plan.blocks.slice(currentIndex, currentIndex + 3);

  return visibleBlocks.map((block, index) => ({
    id: block.id,
    title: block.title,
    description: getTopTaskDescription(block),
    block_type: block.block_type,
    status:
      currentIndex !== -1 && index === 0 && block.status !== "completed" ? "in_progress" : block.status,
    minutes: block.minutes,
    section: block.section_hint,
    is_current: currentIndex === -1 ? index === visibleBlocks.length - 1 : index === 0,
  }));
}

export function getLatestLinkedSolveReviewHref(plan: DailyPlan | null): string | null {
  if (!plan) {
    return null;
  }

  const linkedSessionId =
    [...plan.blocks].reverse().find((block) => block.linked_session_id)?.linked_session_id ?? null;

  if (!linkedSessionId) {
    return null;
  }

  return `/solve/${linkedSessionId}/review`;
}

export function getCurrentSolveSection(input: {
  plan: DailyPlan | null;
  next_action: TodayNextAction | null;
}): Section | null {
  if (input.next_action?.type !== "solve") {
    return null;
  }

  const currentBlock = getCurrentPlanBlock(input.plan);
  if (currentBlock?.block_type !== "main_block") {
    return null;
  }

  return currentBlock.section_hint;
}

export function getSolveGuardState(section: Section | null, availableProblemCount: number | null): {
  blocked: boolean;
  section: Section | null;
  problemsHref: string;
  message: string | null;
} {
  const problemsHref = buildProblemsWorkbenchHref(section);

  if (!section || availableProblemCount === null) {
    return {
      blocked: false,
      section,
      problemsHref,
      message: null,
    };
  }

  if (availableProblemCount > 0) {
    return {
      blocked: false,
      section,
      problemsHref,
      message: null,
    };
  }

  return {
    blocked: true,
    section,
    problemsHref,
    message: `${section} 스프린트에 쓸 문제가 아직 없습니다. 먼저 starter 세트를 준비하세요.`,
  };
}

export function getWarmupPracticeCards(input: {
  yesterdayWeakness: SummarySubType[];
  fallbackSection: Section | null;
}): TodayWarmupPracticeCard[] {
  const weaknessCards = input.yesterdayWeakness.slice(0, 2).map((item) => {
    const template = getSectionWarmupTemplate(item.section);

    return {
      id: `${item.section}-${item.sub_type}`,
      title: `${formatSectionLabel(item.section)} / ${item.sub_type} 리마인드`,
      ask: `${item.sub_type}에서 먼저 확인할 질문: ${template.ask}`,
      key_factor: `최근 ${item.total}회 중 ${item.incorrect}회 실수. ${template.key_factor}`,
      check: template.check,
      source: "yesterday weakness",
    };
  });

  if (weaknessCards.length > 0) {
    return weaknessCards;
  }

  if (input.fallbackSection) {
    const template = getSectionWarmupTemplate(input.fallbackSection);

    return [
      {
        id: `section-${input.fallbackSection}`,
        title: `${formatSectionLabel(input.fallbackSection)} starter reminder`,
        ask: template.ask,
        key_factor: template.key_factor,
        check: template.check,
        source: "next main solve",
      },
    ];
  }

  const template = getSectionWarmupTemplate(null);
  return [
    {
      id: "generic-gmat-reminder",
      title: "GMAT starter reminder",
      ask: template.ask,
      key_factor: template.key_factor,
      check: template.check,
      source: "generic fallback",
    },
  ];
}

export function getTodayPrimaryAction(input: {
  hasStartedToday: boolean;
  currentBlock: DailyPlanBlock | null;
  nextAction: TodayNextAction | null;
  solveBlocked: boolean;
  solveProblemsHref: string;
  reviewHasContent: boolean;
  consolidationReviewHref: string | null;
}): TodayPrimaryAction {
  if (input.solveBlocked) {
    return {
      kind: "solve_blocked",
      label: "문제 준비하러 가기",
      href: input.solveProblemsHref,
      description: "메인 solve에 필요한 문제 세트를 먼저 준비합니다.",
    };
  }

  if (!input.hasStartedToday) {
    return {
      kind: "start_day",
      label: "오늘 스프린트 시작",
      href: null,
      description: "오늘 플랜을 만들고 첫 solve 세션까지 연결합니다.",
    };
  }

  if (input.currentBlock?.block_type === "warmup_review" || input.nextAction?.type === "review") {
    if (input.reviewHasContent) {
      return {
        kind: "review_route",
        label: "Warmup review 열기",
        href: input.nextAction?.href ?? "/review/reports",
        description: "실제 review 아이템이 있어서 review workbench로 이동합니다.",
      };
    }

    return {
      kind: "warmup_inline",
      label: "Warmup 완료하고 메인으로",
      href: null,
      description: "바로 읽고 시작할 연습 문장을 홈에서 먼저 확인합니다.",
    };
  }

  if (input.currentBlock?.block_type === "main_block" || input.nextAction?.type === "solve") {
    return {
      kind: "solve",
      label:
        input.currentBlock?.status === "in_progress"
          ? "메인 solve 이어서 하기"
          : "메인 solve 시작",
      href: null,
      description: "서버에 저장된 solve 상태를 기준으로 같은 문제 위치를 복구합니다.",
    };
  }

  if (input.currentBlock?.block_type === "consolidation" || input.nextAction?.type === "consolidation") {
    if (input.consolidationReviewHref) {
      return {
        kind: "consolidation_route",
        label: "Quick Review 쓰기",
        href: input.consolidationReviewHref,
        description: "방금 푼 solve 세션 review로 이동해 Quick Report 초안을 엽니다.",
      };
    }

    return {
      kind: "consolidation_blocked",
      label: "메인 solve 세션 확인 필요",
      href: null,
      description: "연결된 solve 세션이 없어서 Quick Review를 바로 열 수 없습니다.",
    };
  }

  return {
    kind: "booklet_route",
    label: "오늘 요약집 보기",
    href: "/summary?version=today",
    description: "오늘 누적된 answer flow, summary card, rule을 요약집으로 확인합니다.",
  };
}

export function getTodayStartCheckin(checkin: DailyCheckin | null): TodayStartRequest["checkin"] {
  if (!checkin) {
    return { ...DEFAULT_TODAY_START_CHECKIN };
  }

  return {
    energy: checkin.energy,
    focus: checkin.focus,
    stress: checkin.stress,
    sleep_quality: checkin.sleep_quality,
    confidence: checkin.confidence,
    available_minutes: checkin.available_minutes,
  };
}

export function getTodayQueueFocusLine(queueCounts: TodayQueueCounts | null): string {
  if (!queueCounts || queueCounts.total === 0) {
    return "오늘 큐가 아직 비어 있습니다. 문제를 준비하면 바로 같은 흐름으로 이어서 풀 수 있습니다.";
  }

  if (queueCounts.due_review > 0) {
    return `오늘은 due review ${queueCounts.due_review}개를 먼저 처리하고, 새 문제 ${queueCounts.new_problems}개로 이어갑니다.`;
  }

  if (queueCounts.new_problems > 0) {
    return `오늘은 새 문제 ${queueCounts.new_problems}개를 한 번에 이어서 풉니다.`;
  }

  return "오늘 큐를 모두 마쳤습니다. 필요하면 요약집과 리포트를 보조 화면에서 확인하면 됩니다.";
}

export function getTodayQueuePrimaryAction(input: {
  resumeSessionId: string | null;
  focusProblemId: string | null;
  queueCounts: TodayQueueCounts | null;
  problemsHref: string;
}): TodayQueuePrimaryAction {
  const counts = input.queueCounts;

  if (!counts || counts.total === 0) {
    return {
      kind: "prepare",
      label: "문제 준비하기",
      href: input.problemsHref,
      description: "오늘 큐에 넣을 curated 문제가 아직 없습니다.",
    };
  }

  if (input.resumeSessionId && input.focusProblemId) {
    return {
      kind: "resume",
      label: "이어 풀기",
      href: `/solve/${input.resumeSessionId}`,
      description: "서버에 저장된 solve 상태 기준으로 같은 문제 위치에서 이어집니다.",
    };
  }

  if (input.focusProblemId) {
    return {
      kind: "start",
      label: "오늘 리스트 시작",
      href: null,
      description: "오늘 큐를 하나의 solve runner에서 끊김 없이 시작합니다.",
    };
  }

  return {
    kind: "completed",
    label: "오늘 완료",
    href: "/summary?version=today",
    description: "오늘 큐는 끝났습니다. 필요하면 요약집을 열어 핵심만 다시 확인하면 됩니다.",
  };
}

export function getTodayQueueItems(snapshot: TodaySnapshot | null): TodayQueueItem[] {
  return snapshot?.today_queue ?? [];
}
