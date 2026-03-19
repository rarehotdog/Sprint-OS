import { NextResponse } from "next/server";

import {
  postTodayStartResponseSchema,
  postTodayStartSchema,
} from "@/lib/contracts/today-contracts";
import { buildProblemsWorkbenchHref } from "@/lib/problems-ui";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import type { DailyPlan, Section, SessionType, TodayQueueItem } from "@/lib/types";

function sessionTypeForQueue(queue: TodayQueueItem[]): SessionType {
  const sections = Array.from(new Set(queue.map((item) => item.section)));

  if (sections.length === 1) {
    if (sections[0] === "verbal") return "sprint_verbal";
    if (sections[0] === "quant") return "sprint_quant";
    return "sprint_di";
  }

  return "drill";
}

function buildSectionMetadata(queue: TodayQueueItem[]): {
  section_hint: Section | null;
  section_order: Section[];
  section_bounds: Array<{ section: Section; start_index: number; end_index: number }>;
} {
  const sectionOrder: Section[] = [];
  const sectionBounds: Array<{ section: Section; start_index: number; end_index: number }> = [];

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    const last = sectionBounds[sectionBounds.length - 1];

    if (last && last.section === item.section) {
      last.end_index = index + 1;
      continue;
    }

    sectionOrder.push(item.section);
    sectionBounds.push({
      section: item.section,
      start_index: index,
      end_index: index + 1,
    });
  }

  return {
    section_hint: queue[0]?.section ?? null,
    section_order: Array.from(new Set(sectionOrder)),
    section_bounds: sectionBounds,
  };
}

function findMainBlock(plan: DailyPlan): DailyPlan["blocks"][number] | null {
  return (
    plan.blocks.find((block) => block.block_type === "main_block" && block.status !== "completed") ??
    plan.blocks.find((block) => block.block_type === "main_block") ??
    null
  );
}

function buildSolveRedirect(sessionId: string, focusProblemId: string | null, queue: TodayQueueItem[]): string {
  const params = new URLSearchParams();
  const focusIndex = focusProblemId ? queue.findIndex((item) => item.problem_id === focusProblemId) : -1;
  const focusItem = focusIndex >= 0 ? queue[focusIndex] : queue[0];

  if (focusIndex >= 0) {
    params.set("q", String(focusIndex + 1));
  }

  if (focusItem?.section) {
    params.set("section", focusItem.section);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `/solve/${sessionId}${suffix}`;
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = postTodayStartSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid today start payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const started = await repositories.today.start(parsed.data);
  const pendingQueue = started.today_queue.filter((item) => item.status !== "completed");

  if (started.resume_session_id) {
    return NextResponse.json(
      postTodayStartResponseSchema.parse({
        ...started,
        redirect_to: buildSolveRedirect(started.resume_session_id, started.focus_problem_id, pendingQueue),
      }),
    );
  }

  if (pendingQueue.length === 0) {
    const problemsHref = buildProblemsWorkbenchHref(findMainBlock(started.plan)?.section_hint ?? null);

    return NextResponse.json(
      postTodayStartResponseSchema.parse({
        ...started,
        redirect_to: started.next_action.type === "booklet" ? "/summary" : problemsHref,
      }),
    );
  }

  const queueMeta = pendingQueue.map((item) => ({
    problem_id: item.problem_id,
    source: item.source,
    review_queue_id: item.review_queue_id,
    due_at: item.due_at,
  }));
  const solveContext = buildSectionMetadata(pendingQueue);
  const session = await repositories.solve.createSession({
    session_type: sessionTypeForQueue(pendingQueue),
    recipe: "today_queue",
    duration_planned_min: started.queue_counts.estimated_minutes || started.checkin.available_minutes,
    problem_ids: pendingQueue.map((item) => item.problem_id),
    meta: {
      source: "today_start",
      today_date: parsed.data.date,
      today_queue: queueMeta,
      section_hint: solveContext.section_hint,
      section_order: solveContext.section_order,
      section_bounds: solveContext.section_bounds,
    },
  });

  const mainBlock = findMainBlock(started.plan);
  const updatedPlan = mainBlock
    ? await repositories.today.attachSession(parsed.data.date, mainBlock.id, session.id)
    : started.plan;

  return NextResponse.json(
    postTodayStartResponseSchema.parse({
      ...started,
      plan: updatedPlan,
      resume_session_id: session.id,
      redirect_to: buildSolveRedirect(session.id, pendingQueue[0]?.problem_id ?? null, pendingQueue),
    }),
  );
}
