import type {
  DailyCheckin,
  DailyPlan,
  DailyPlanBlock,
  DailyPlanBlockType,
  Section,
  TodayBookletCandidate,
  TodayNextAction,
  TodayQueueCounts,
  TodayQueueItem,
  TodaySnapshot,
} from "@/lib/types";

import type {
  PostTodayCheckinInput,
  PostTodayPlanInput,
  PostTodayProgressInput,
  PostTodayReplanInput,
  PostTodayStartInput,
} from "@/lib/contracts/today-contracts";

import {
  listBookletEligibleRules,
  listCuratedKnowledgeReports,
  listSummaryCards,
} from "@/lib/server/knowledge-stack-store";
import { listProblemsByIds, listSolveReadyProblems } from "@/lib/server/problems-store";
import { listQueueItems } from "@/lib/server/review-queue-store";
import { getSessionById, getSessionRunState } from "@/lib/server/solve-store";
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
  const startOfDay = new Date(`${dateYmd}T00:00:00.000Z`).getTime();
  const endOfDay = new Date(`${dateYmd}T23:59:59.999Z`).getTime();
  return listQueueItems()
    .filter((item) => {
      const time = new Date(item.next_review_at).getTime();
      const createdAt = new Date(item.created_at).getTime();
      return (
        Number.isFinite(time) &&
        Number.isFinite(createdAt) &&
        time <= endOfDay &&
        createdAt < startOfDay
      );
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

function getDailyQueueTargets(availableMinutes: number): {
  due_review: number;
  new_problems: number;
} {
  if (availableMinutes <= 60) {
    return { due_review: 2, new_problems: 5 };
  }

  if (availableMinutes <= 120) {
    return { due_review: 3, new_problems: 8 };
  }

  return { due_review: 5, new_problems: 12 };
}

function buildQueueCounts(input: {
  dueReview: number;
  newProblems: number;
  completed: number;
  targetDueReview: number;
  targetNewProblems: number;
  shortage: boolean;
}): TodayQueueCounts {
  return {
    due_review: input.dueReview,
    new_problems: input.newProblems,
    completed: input.completed,
    total: input.dueReview + input.newProblems + input.completed,
    target_due_review: input.targetDueReview,
    target_new_problems: input.targetNewProblems,
    estimated_minutes: input.dueReview * 3 + input.newProblems * 8,
    shortage: input.shortage,
  };
}

function getQueueTitle(section: Section, subType: string): string {
  return `${section.toUpperCase()} / ${subType}`;
}

function buildQueueItem(input: {
  problem_id: string;
  review_queue_id: string | null;
  section: Section;
  sub_type: string;
  source: TodayQueueItem["source"];
  status: TodayQueueItem["status"];
  due_at?: string | null;
}): TodayQueueItem {
  return {
    id: input.problem_id,
    problem_id: input.problem_id,
    review_queue_id: input.review_queue_id,
    section: input.section,
    sub_type: input.sub_type,
    source: input.source,
    status: input.status,
    title: getQueueTitle(input.section, input.sub_type),
    due_at: input.due_at ?? null,
  };
}

function getFocusSection(plan: DailyPlan | null): Section | null {
  const planned = plan?.blocks.find((block) => block.block_type === "main_block")?.section_hint;
  if (planned) {
    return planned;
  }

  return getWeakSubtypes()[0]?.section ?? null;
}

function prioritizeNewProblems(
  problems: ReturnType<typeof listSolveReadyProblems>,
  preferredSections: Section[],
): ReturnType<typeof listSolveReadyProblems> {
  const sectionRank = new Map(preferredSections.map((section, index) => [section, index]));

  return [...problems].sort((left, right) => {
    const leftRank = sectionRank.get(left.section) ?? preferredSections.length;
    const rightRank = sectionRank.get(right.section) ?? preferredSections.length;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return right.created_at.localeCompare(left.created_at);
  });
}

function getLatestLinkedSessionId(plan: DailyPlan | null): string | null {
  if (!plan) {
    return null;
  }

  return [...plan.blocks].reverse().find((block) => block.linked_session_id)?.linked_session_id ?? null;
}

function readTodayQueueMeta(sessionMeta: Record<string, unknown>): Array<{
  problem_id: string;
  source: TodayQueueItem["source"];
  review_queue_id: string | null;
  due_at: string | null;
}> {
  const raw = sessionMeta.today_queue;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const source = record.source === "due_review" || record.source === "new" ? record.source : null;
      const problemId = typeof record.problem_id === "string" ? record.problem_id : null;
      if (!source || !problemId) {
        return null;
      }

      return {
        problem_id: problemId,
        source,
        review_queue_id: typeof record.review_queue_id === "string" ? record.review_queue_id : null,
        due_at: typeof record.due_at === "string" ? record.due_at : null,
      };
    })
    .filter((item): item is {
      problem_id: string;
      source: TodayQueueItem["source"];
      review_queue_id: string | null;
      due_at: string | null;
    } => item !== null);
}

function buildPreviewQueue(dateYmd: string, checkin: DailyCheckin | null, plan: DailyPlan | null): {
  resume_session_id: string | null;
  today_queue: TodayQueueItem[];
  focus_problem_id: string | null;
  queue_counts: TodayQueueCounts;
} {
  const targets = getDailyQueueTargets(checkin?.available_minutes ?? 90);
  const preferredSections = [
    getFocusSection(plan),
    ...getWeakSubtypes().map((item) => item.section),
  ].filter((section, index, all): section is Section => section !== null && all.indexOf(section) === index);
  const dueReview = getDueReviewItems(dateYmd).slice(0, targets.due_review);
  const dueProblems = listProblemsByIds(dueReview.map((item) => item.problem_id));
  const dueByProblemId = new Map(dueReview.map((item) => [item.problem_id, item]));
  const dueQueue = dueProblems.map((problem, index) =>
    buildQueueItem({
      problem_id: problem.id,
      review_queue_id: dueByProblemId.get(problem.id)?.review_queue_id ?? null,
      section: problem.section,
      sub_type: problem.sub_type,
      source: "due_review",
      status: index === 0 ? "current" : "pending",
      due_at: dueByProblemId.get(problem.id)?.next_review_at ?? null,
    }),
  );
  const excludedProblemIds = new Set(dueQueue.map((item) => item.problem_id));
  const newProblems = prioritizeNewProblems(listSolveReadyProblems(), preferredSections)
    .filter((problem) => !excludedProblemIds.has(problem.id))
    .slice(0, targets.new_problems);
  const newQueue = newProblems.map((problem, index) =>
    buildQueueItem({
      problem_id: problem.id,
      review_queue_id: null,
      section: problem.section,
      sub_type: problem.sub_type,
      source: "new",
      status: dueQueue.length === 0 && index === 0 ? "current" : "pending",
    }),
  );
  const todayQueue = [...dueQueue, ...newQueue];

  return {
    resume_session_id: null,
    today_queue: todayQueue,
    focus_problem_id: todayQueue.find((item) => item.status === "current")?.problem_id ?? null,
    queue_counts: buildQueueCounts({
      dueReview: dueQueue.length,
      newProblems: newQueue.length,
      completed: 0,
      targetDueReview: targets.due_review,
      targetNewProblems: targets.new_problems,
      shortage: newQueue.length < targets.new_problems,
    }),
  };
}

function buildSessionBackedQueue(dateYmd: string, checkin: DailyCheckin | null, plan: DailyPlan | null): {
  resume_session_id: string | null;
  today_queue: TodayQueueItem[];
  focus_problem_id: string | null;
  queue_counts: TodayQueueCounts;
} | null {
  const sessionId = getLatestLinkedSessionId(plan);
  if (!sessionId) {
    return null;
  }

  const session = getSessionById(sessionId);
  const runState = getSessionRunState(sessionId);
  if (!session || !runState || runState.ordered_problem_ids.length === 0) {
    return null;
  }

  const targets = getDailyQueueTargets(checkin?.available_minutes ?? session.duration_planned_min ?? 90);
  const problemById = new Map(
    listProblemsByIds(runState.ordered_problem_ids).map((problem) => [problem.id, problem]),
  );
  const queueMetaByProblemId = new Map(
    readTodayQueueMeta(session.meta as Record<string, unknown>).map((item) => [item.problem_id, item]),
  );
  const attempted = new Set(runState.attempted_problem_ids);
  const focusProblemId = runState.completed
    ? null
    : runState.next_problem_id ?? runState.ordered_problem_ids[runState.current_index] ?? null;
  const ordered = runState.ordered_problem_ids
    .map((problemId) => {
      const problem = problemById.get(problemId);
      if (!problem) {
        return null;
      }

      const meta = queueMetaByProblemId.get(problemId);
      return buildQueueItem({
        problem_id: problem.id,
        review_queue_id: meta?.review_queue_id ?? null,
        section: problem.section,
        sub_type: problem.sub_type,
        source: meta?.source ?? "new",
        status: attempted.has(problemId)
          ? "completed"
          : focusProblemId === problemId
            ? "current"
            : "pending",
        due_at: meta?.due_at ?? null,
      });
    })
    .filter((item): item is TodayQueueItem => item !== null);

  const pending = ordered.filter((item) => item.status !== "completed");
  const completed = ordered.filter((item) => item.status === "completed");
  const queue = [...pending, ...completed];
  const pendingDue = pending.filter((item) => item.source === "due_review").length;
  const pendingNew = pending.filter((item) => item.source === "new").length;
  const totalNew = queue.filter((item) => item.source === "new").length;

  return {
    resume_session_id: runState.completed ? null : session.id,
    today_queue: queue,
    focus_problem_id: focusProblemId,
    queue_counts: buildQueueCounts({
      dueReview: pendingDue,
      newProblems: pendingNew,
      completed: completed.length,
      targetDueReview: targets.due_review,
      targetNewProblems: targets.new_problems,
      shortage: totalNew < targets.new_problems,
    }),
  };
}

function buildTodayQueue(dateYmd: string, checkin: DailyCheckin | null, plan: DailyPlan | null): {
  resume_session_id: string | null;
  today_queue: TodayQueueItem[];
  focus_problem_id: string | null;
  queue_counts: TodayQueueCounts;
} {
  return buildSessionBackedQueue(dateYmd, checkin, plan) ?? buildPreviewQueue(dateYmd, checkin, plan);
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

  const reportCandidates = listCuratedKnowledgeReports()
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

  const ruleCandidates = listBookletEligibleRules()
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

  const queue = buildTodayQueue(dateYmd, checkin, plan);

  return {
    checkin,
    yesterday_weakness: yesterdayWeakness,
    due_review: dueReview,
    plan,
    progress: computeTodayProgress(plan),
    booklet_candidates: buildBookletCandidates(),
    next_action: resolveNextAction(plan),
    resume_session_id: queue.resume_session_id,
    today_queue: queue.today_queue,
    focus_problem_id: queue.focus_problem_id,
    queue_counts: queue.queue_counts,
  };
}

export function startTodayLoop(input: PostTodayStartInput): {
  checkin: DailyCheckin;
  plan: DailyPlan;
  progress: TodaySnapshot["progress"];
  next_action: TodayNextAction;
  redirect_to: string;
  resume_session_id: string | null;
  today_queue: TodayQueueItem[];
  focus_problem_id: string | null;
  queue_counts: TodayQueueCounts;
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
  const snapshot = getTodaySnapshot(input.date);

  return {
    checkin,
    plan: built.plan,
    progress,
    next_action: nextAction,
    redirect_to: nextAction.href,
    resume_session_id: snapshot.resume_session_id,
    today_queue: snapshot.today_queue,
    focus_problem_id: snapshot.focus_problem_id,
    queue_counts: snapshot.queue_counts,
  };
}

export function resetTodayStoreForTests(): void {
  global.__gmatTodayDb__ = {
    checkins: new Map<string, DailyCheckin>(),
    plans: new Map<string, DailyPlan>(),
  };
}
