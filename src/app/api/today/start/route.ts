import { NextResponse } from "next/server";

import {
  postTodayStartResponseSchema,
  postTodayStartSchema,
} from "@/lib/contracts/today-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import type { DailyPlan, Section, SessionType } from "@/lib/types";

function getCurrentBlock(plan: DailyPlan) {
  return (
    plan.blocks.find((block) => block.status === "in_progress") ??
    plan.blocks.find((block) => block.status === "pending") ??
    null
  );
}

function sessionTypeForSection(section: Section): SessionType {
  if (section === "verbal") return "sprint_verbal";
  if (section === "quant") return "sprint_quant";
  return "sprint_di";
}

export async function POST(request: Request) {
  const repositories = getServerRepositories();
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

  const started = repositories.today.start(parsed.data);
  const currentBlock = getCurrentBlock(started.plan);

  if (
    started.next_action.type === "solve" &&
    currentBlock?.block_type === "main_block" &&
    currentBlock.section_hint
  ) {
    const linkedSession = currentBlock.linked_session_id
      ? repositories.solve.getSessionById(currentBlock.linked_session_id)
      : null;

    const session =
      linkedSession ??
      repositories.solve.createSession({
        session_type: sessionTypeForSection(currentBlock.section_hint),
        recipe: "today_auto_start",
        duration_planned_min: currentBlock.minutes,
        meta: {
          section: currentBlock.section_hint,
          section_hint: currentBlock.section_hint,
          sprint_duration_min: currentBlock.minutes,
          today_date: parsed.data.date,
          source: "today_start",
        },
      });

    const updatedPlan = linkedSession
      ? started.plan
      : repositories.today.attachSession(parsed.data.date, currentBlock.id, session.id);

    return NextResponse.json(
      postTodayStartResponseSchema.parse({
        ...started,
        plan: updatedPlan,
        redirect_to: `/solve/${session.id}?section=${encodeURIComponent(
          currentBlock.section_hint,
        )}&duration=${currentBlock.minutes}`,
      }),
    );
  }

  return NextResponse.json(postTodayStartResponseSchema.parse(started));
}
