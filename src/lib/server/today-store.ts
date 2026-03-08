import type {
  DailyCheckin,
  DailyPlan,
  DailyPlanBlock,
  DailyPlanBlockType,
  Section,
  TodayBookletCandidate,
  TodayNextAction,
  TodaySnapshot,
} from "@/lib/types";

import type {
  PostTodayCheckinInput,
  PostTodayPlanInput,
  PostTodayProgressInput,
  PostTodayReplanInput,
  PostTodayStartInput,
} from "@/lib/contracts/today-contracts";

import { listSummaryCards } from "@/lib/server/knowledge-stack-store";
import { listReports, listRules } from "@/lib/server/report-store";
import { listQueueItems } from "@/lib/server/review-queue-store";
import { getWeaknessAnalytics } from "@/lib/server/weakness-analytics";

interface TodayDb {
  checkins: Map<string, DailyCheckin>;
  plans: Map<string, DailyPlan>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatTodayDb__: TodayDb | undefined;
}

function getDb(): TodayDb {
  if (!global.__gmatTodayDb__) {
    global.__gmatTodayDb__ = {
      checkins: new Map<string, DailyCheckin>(),
      plans: new Map<string, DailyPlan>(),
    };
  }

  return global.__gmatTodayDb__;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDateYmd(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  return new Date().toISOString().slice(0, 10);
}

function roundToTens(value: number): number {
  return Math.max(10, Math.round(value / 10) * 10);
}

function getYesterday(dateYmd: string): string {
  const date = new Date(`${dateYmd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getDueReviewItems(dateYmd: string): Array<{
  review_queue_id: string;
  problem_id: string;
  next_review_at: string;
  priority_score: number;
}> {
  const endOfDay = new Date(`${dateYmd}T23:59:59.999Z`).getTime();
  return listQueueItems()
    .filter((item) => {
      const time = new Date(item.next_review_at).getTime();
      return Number.isFinite(time) && time <= endOfDay;
    })
    .slice(0, 10)
    .map((item) => ({
      review_queue_id: item.id,
      problem_id: item.problem_id,
      next_review_at: item.next_review_at,
      priority_score: item.priority_score,
    }));
}

function getWeakSubtypes() {
  return getWeaknessAnalytics({ days: 14 }).subtype_weakness;
}

function computeTodayProgress(plan: DailyPlan | null): TodaySnapshot["progress"] {
  if (!plan) {
    return {
      total_blocks: 0,
      completed_blocks: 0,
      current_block_id: null,
      completion_rate: 0,
    };
  }

  const totalBlocks = plan.blocks.length;
  const completedBlocks = plan.blocks.filter((block) => block.status === "completed").length;
  const currentBlock =
    plan.blocks.find((block) => block.status === "in_progress") ??
    plan.blocks.find((block) => block.status === "pending") ??
    null;

  return {
    total_blocks: totalBlocks,
    completed_blocks: completedBlocks,
    current_block_id: currentBlock?.id ?? null,
    completion_rate: totalBlocks > 0 ? completedBlocks / totalBlocks : 0,
  };
}

function resolveNextAction(plan: DailyPlan | null): TodayNextAction {
  if (!plan || plan.blocks.length === 0) {
    return {
      type: "review",
      label: "어제 약점/복습부터 시작",
      href: "/review/reports",
    };
  }

  const current =
    plan.blocks.find((block) => block.status === "in_progress") ??
    plan.blocks.find((block) => block.status === "pending") ??
    null;

  if (!current) {
    return {
      type: "booklet",
      label: "오늘 요약집 반영 확인",
      href: "/summary",
    };
  }

  if (current.block_type === "warmup_review") {
    return {
      type: "review",
      label: "Due review 먼저 처리",
      href: "/review/reports",
    };
  }

  if (current.block_type === "main_block") {
    return {
      type: "solve",
      label: "메인 문제 풀이 시작",
      href: "/solve",
    };
  }

  if (current.block_type === "consolidation") {
    return {
      type: "consolidation",
      label: "Deep 확장/복기 진행",
      href: "/review/deepen",
    };
  }

  return {
    type: "booklet",
    label: "요약집 갱신 확인",
    href: "/summary",
  };
}

function buildBookletCandidates(): TodayBookletCandidate[] {
  const cardCandidates = listSummaryCards(8).map((card) => ({
    kind: card.card_type,
    text: card.content,
    source_report_id: card.source_report_id,
    source_rule_id: card.source_rule_id,
  }));

  const reportCandidates = listReports()
    .filter((report) => report.report_mode === "deep")
    .slice(0, 5)
    .flatMap((report) => {
      const out: TodayBookletCandidate[] = [];

      if (report.mechanism_english) {
        out.push({
          kind: "mechanism",
          text: report.mechanism_english,
          source_report_id: report.id,
          source_rule_id: null,
        });
      }

      if (report.logic_comparison) {
        out.push({
          kind: "flow",
          text: report.logic_comparison,
          source_report_id: report.id,
          source_rule_id: null,
        });
      }

      return out;
    });

  const ruleCandidates = listRules()
    .slice(0, 5)
    .map((rule) => ({
      kind: "tip" as const,
      text: rule.content,
      source_report_id: rule.source_report_id,
      source_rule_id: rule.id,
    }));

  const deduped = new Map<string, TodayBookletCandidate>();
  for (const candidate of [...reportCandidates, ...ruleCandidates]) {
    const key = `${candidate.kind}::${candidate.text.trim()}`;
    if (!candidate.text.trim() || deduped.has(key)) {
      continue;
    }
    deduped.set(key, candidate);
  }

  for (const candidate of cardCandidates) {
    const key = `${candidate.kind}::${candidate.text.trim()}`;
    if (!candidate.text.trim() || deduped.has(key)) {
      continue;
    }
    deduped.set(key, candidate);
  }

  return Array.from(deduped.values()).slice(0, 10);
}

function splitMinutes(availableMinutes: number): {
  warmup: number;
  main: number;
  consolidation: number;
  booklet: number;
} {
  const total = Math.max(40, availableMinutes);
  const warmup = roundToTens(total * 0.2);
  let main = roundToTens(total * 0.6);
  let remaining = total - warmup - main;

  if (remaining < 20) {
    const deficit = 20 - remaining;
    main = Math.max(20, main - roundToTens(deficit));
    remaining = total - warmup - main;
  }

  const booklet = 10;
  const consolidation = Math.max(10, remaining - booklet);

  const finalTotal = warmup + main + consolidation + booklet;
  if (finalTotal !== total) {
    const delta = total - finalTotal;
    main = Math.max(20, main + delta);
  }

  return { warmup, main, consolidation, booklet };
}

function makeBlock(
  blockType: DailyPlanBlockType,
  title: string,
  minutes: number,
  status: DailyPlanBlock["status"],
  targetIds: string[],
  sectionHint: Section | null,
  notes: string | null,
): DailyPlanBlock {
  return {
    id: crypto.randomUUID(),
    block_type: blockType,
    title,
    minutes,
    status,
    target_ids: targetIds,
    section_hint: sectionHint,
    linked_session_id: null,
    notes,
  };
}

function getMainBlockTitle(): string {
  const topWeak = getWeakSubtypes()[0];
  if (!topWeak) {
    return "메인 풀이 블록";
  }

  return `${topWeak.section}/${topWeak.sub_type} 집중 풀이`;
}

export function upsertDailyCheckin(input: PostTodayCheckinInput): DailyCheckin {
  const date = toDateYmd(input.date);
  const existing = getDb().checkins.get(date);
  const timestamp = nowIso();

  const next: DailyCheckin = {
    id: existing?.id ?? crypto.randomUUID(),
    date,
    energy: input.energy,
    focus: input.focus,
    stress: input.stress,
    sleep_quality: input.sleep_quality,
    confidence: input.confidence,
    available_minutes: input.available_minutes,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
  };

  getDb().checkins.set(date, next);
  return next;
}

export function getDailyCheckin(date?: string): DailyCheckin | null {
  return getDb().checkins.get(toDateYmd(date)) ?? null;
}

export function getDailyPlan(date?: string): DailyPlan | null {
  return getDb().plans.get(toDateYmd(date)) ?? null;
}

export function generateDailyPlan(input: PostTodayPlanInput): {
  plan: DailyPlan;
  source_counts: DailyPlan["source_counts"];
  next_action: TodayNextAction;
} {
  const date = toDateYmd(input.date);
  const existing = getDb().plans.get(date);

  if (existing && !input.force_regenerate) {
    return {
      plan: existing,
      source_counts: existing.source_counts,
      next_action: resolveNextAction(existing),
    };
  }

  const checkin = getDailyCheckin(date);
  const dueReview = getDueReviewItems(date);
  const weakSubtypes = getWeakSubtypes();
  const yesterdayWeakness = weakSubtypes.slice(0, 3);
  const { warmup, main, consolidation, booklet } = splitMinutes(checkin?.available_minutes ?? 120);

  const blocks: DailyPlanBlock[] = [
    makeBlock(
      "warmup_review",
      "Yesterday Weakness + Due Review",
      warmup,
      "in_progress",
      dueReview.map((item) => item.problem_id),
      null,
      `어제(${getYesterday(date)}) 약점 우선 처리`,
    ),
    makeBlock(
      "main_block",
      getMainBlockTitle(),
      main,
      "pending",
      [],
      yesterdayWeakness[0]?.section ?? "verbal",
      null,
    ),
    makeBlock("consolidation", "Quick -> Deep 정리", consolidation, "pending", [], null, null),
    makeBlock("booklet_refresh", "요약집 후보 갱신", booklet, "pending", [], null, null),
  ];

  const plan: DailyPlan = {
    id: existing?.id ?? crypto.randomUUID(),
    date,
    generated_at: nowIso(),
    source_counts: {
      yesterday_weakness: yesterdayWeakness.length,
      due_review: dueReview.length,
      weak_clusters: weakSubtypes.length,
    },
    blocks,
  };

  getDb().plans.set(date, plan);

  return {
    plan,
    source_counts: plan.source_counts,
    next_action: resolveNextAction(plan),
  };
}

export function replanDaily(input: PostTodayReplanInput): {
  plan: DailyPlan;
  changed_blocks: string[];
  next_action: TodayNextAction;
} {
  const date = toDateYmd(input.date);
  const existing = getDb().plans.get(date);

  if (!existing) {
    const generated = generateDailyPlan({ date, force_regenerate: false });
    return {
      plan: generated.plan,
      changed_blocks: generated.plan.blocks.map((block) => block.id),
      next_action: generated.next_action,
    };
  }

  const remainingMinutes = input.remaining_minutes ?? existing.blocks.reduce((sum, block) => {
    if (block.status === "completed") {
      return sum;
    }
    return sum + block.minutes;
  }, 0);

  const weights: Record<DailyPlanBlockType, number> = {
    warmup_review: 2,
    main_block: 6,
    consolidation: 2,
    booklet_refresh: 1,
  };

  const pendingBlocks = existing.blocks.filter((block) => block.status !== "completed");
  const totalWeight = pendingBlocks.reduce((sum, block) => sum + weights[block.block_type], 0);

  const nextBlocks = existing.blocks.map((block) => ({ ...block }));
  const changedBlocks: string[] = [];

  if (pendingBlocks.length > 0 && totalWeight > 0) {
    let assigned = 0;

    for (let index = 0; index < nextBlocks.length; index += 1) {
      const block = nextBlocks[index];
      if (block.status === "completed") {
        continue;
      }

      const isLastPending = pendingBlocks[pendingBlocks.length - 1]?.id === block.id;
      let nextMinutes = roundToTens((remainingMinutes * weights[block.block_type]) / totalWeight);

      if (isLastPending) {
        nextMinutes = Math.max(10, remainingMinutes - assigned);
      }

      assigned += nextMinutes;
      block.minutes = nextMinutes;
      block.notes = [block.notes, `replan: ${input.reason}`].filter(Boolean).join(" | ");
      changedBlocks.push(block.id);
    }

    let firstActiveAssigned = false;
    for (const block of nextBlocks) {
      if (block.status === "completed") {
        continue;
      }
      if (!firstActiveAssigned) {
        block.status = "in_progress";
        firstActiveAssigned = true;
      } else {
        block.status = "pending";
      }
    }
  }

  const nextPlan: DailyPlan = {
    ...existing,
    generated_at: nowIso(),
    blocks: nextBlocks,
  };

  getDb().plans.set(date, nextPlan);

  return {
    plan: nextPlan,
    changed_blocks: changedBlocks,
    next_action: resolveNextAction(nextPlan),
  };
}

export function updateDailyPlanBlockStatus(input: PostTodayProgressInput): {
  plan: DailyPlan;
  changed_blocks: string[];
  next_action: TodayNextAction;
} {
  const date = toDateYmd(input.date);
  const existing = getDb().plans.get(date);
  if (!existing) {
    throw new Error("Plan not found");
  }

  const changedBlocks: string[] = [];
  const nextBlocks = existing.blocks.map((block) => ({ ...block }));
  const targetIndex = nextBlocks.findIndex((block) => block.id === input.block_id);

  if (targetIndex === -1) {
    throw new Error("Block not found");
  }

  const target = nextBlocks[targetIndex];
  if (target.status !== input.status) {
    target.status = input.status;
    changedBlocks.push(target.id);
  }

  if (input.status === "in_progress") {
    for (const block of nextBlocks) {
      if (block.id === target.id || block.status === "completed") {
        continue;
      }
      if (block.status !== "pending") {
        block.status = "pending";
        changedBlocks.push(block.id);
      }
    }
  }

  if (input.status === "completed") {
    const nextPending = nextBlocks.find((block) => block.status === "pending");
    if (nextPending) {
      nextPending.status = "in_progress";
      changedBlocks.push(nextPending.id);
    }
  }

  const updated: DailyPlan = {
    ...existing,
    generated_at: nowIso(),
    blocks: nextBlocks,
  };

  getDb().plans.set(date, updated);
  return {
    plan: updated,
    changed_blocks: Array.from(new Set(changedBlocks)),
    next_action: resolveNextAction(updated),
  };
}

export function attachSessionToPlanBlock(date: string, blockId: string, sessionId: string): DailyPlan {
  const dateYmd = toDateYmd(date);
  const existing = getDb().plans.get(dateYmd);
  if (!existing) {
    throw new Error("Plan not found");
  }

  const nextBlocks = existing.blocks.map((block) =>
    block.id === blockId ? { ...block, linked_session_id: sessionId } : block,
  );
  const changed = nextBlocks.some((block) => block.id === blockId && block.linked_session_id === sessionId);
  if (!changed) {
    throw new Error("Block not found");
  }

  const updated: DailyPlan = {
    ...existing,
    generated_at: nowIso(),
    blocks: nextBlocks,
  };

  getDb().plans.set(dateYmd, updated);
  return updated;
}

export function getTodaySnapshot(date?: string): TodaySnapshot {
  const dateYmd = toDateYmd(date);
  const checkin = getDailyCheckin(dateYmd);
  const dueReview = getDueReviewItems(dateYmd);
  const yesterdayWeakness = getWeakSubtypes().slice(0, 3);

  let plan = getDailyPlan(dateYmd);
  if (!plan && checkin) {
    plan = generateDailyPlan({ date: dateYmd, force_regenerate: false }).plan;
  }

  return {
    checkin,
    yesterday_weakness: yesterdayWeakness,
    due_review: dueReview,
    plan,
    progress: computeTodayProgress(plan),
    booklet_candidates: buildBookletCandidates(),
    next_action: resolveNextAction(plan),
  };
}

export function startTodayLoop(input: PostTodayStartInput): {
  checkin: DailyCheckin;
  plan: DailyPlan;
  progress: TodaySnapshot["progress"];
  next_action: TodayNextAction;
  redirect_to: string;
} {
  const checkin = upsertDailyCheckin({
    date: input.date,
    energy: input.checkin.energy,
    focus: input.checkin.focus,
    stress: input.checkin.stress,
    sleep_quality: input.checkin.sleep_quality,
    confidence: input.checkin.confidence,
    available_minutes: input.checkin.available_minutes,
  });

  const built = generateDailyPlan({
    date: input.date,
    force_regenerate: input.force_regenerate ?? false,
  });

  const progress = computeTodayProgress(built.plan);
  const allCompleted =
    built.plan.blocks.length > 0 &&
    built.plan.blocks.every((block) => block.status === "completed");
  const nextAction = allCompleted
    ? { type: "booklet" as const, label: "오늘 블록 완료 - 요약집 확인", href: "/summary" }
    : built.next_action;

  return {
    checkin,
    plan: built.plan,
    progress,
    next_action: nextAction,
    redirect_to: nextAction.href,
  };
}

export function resetTodayStoreForTests(): void {
  global.__gmatTodayDb__ = {
    checkins: new Map<string, DailyCheckin>(),
    plans: new Map<string, DailyPlan>(),
  };
}
