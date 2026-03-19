import { NextResponse } from "next/server";

import { createSessionSchema, sessionDetailResponseSchema } from "@/lib/contracts/solve-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";
import type { Section, SessionType } from "@/lib/types";

const SECTION_COUNTS: Record<Section, number> = {
  verbal: 23,
  quant: 21,
  di: 20,
};

function asSection(value: unknown): Section | null {
  if (value === "verbal" || value === "quant" || value === "di") {
    return value;
  }
  return null;
}

function pickSectionForSession(sessionType: SessionType, meta: Record<string, unknown>): Section {
  const fromMeta = asSection(meta.section);
  if (fromMeta) {
    return fromMeta;
  }

  if (sessionType === "sprint_verbal") return "verbal";
  if (sessionType === "sprint_quant") return "quant";
  if (sessionType === "sprint_di") return "di";
  return "verbal";
}

async function autoSelectProblemIds(
  sessionType: SessionType,
  meta: Record<string, unknown>,
  listProblems: (section?: Section) => Promise<Array<{ id: string }>>,
): Promise<{
  problemIds: string[];
  sectionOrder: Section[];
  sectionBounds: Array<{ section: Section; start_index: number; end_index: number }>;
}> {
  if (sessionType === "mock_full") {
    const sectionOrder: Section[] = ["verbal", "quant", "di"];
    const problemIds: string[] = [];
    const sectionBounds: Array<{ section: Section; start_index: number; end_index: number }> = [];
    let cursor = 0;

    for (const section of sectionOrder) {
      const ids = (await listProblems(section))
        .map((problem) => problem.id)
        .slice(0, SECTION_COUNTS[section]);
      problemIds.push(...ids);
      sectionBounds.push({
        section,
        start_index: cursor,
        end_index: cursor + ids.length,
      });
      cursor += ids.length;
    }

    return { problemIds, sectionOrder, sectionBounds };
  }

  const section = pickSectionForSession(sessionType, meta);
  const ids = (await listProblems(section))
    .map((problem) => problem.id)
    .slice(0, SECTION_COUNTS[section]);

  return {
    problemIds: ids,
    sectionOrder: [section],
    sectionBounds: [{ section, start_index: 0, end_index: ids.length }],
  };
}

export async function GET(request: Request) {
  const repositories = await getServerRepositories();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ sessions: await repositories.solve.listSessions() });
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }

  const session = await repositories.solve.getSessionById(sessionId);
  const runState = await repositories.solve.getSessionRunState(sessionId);
  const solveContext = await repositories.solve.getSessionSolveContext(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!runState || !solveContext) {
    return NextResponse.json({ error: "Session state unavailable" }, { status: 500 });
  }

  return NextResponse.json(sessionDetailResponseSchema.parse({
    session,
    run_state: runState,
    solve_context: solveContext,
  }));
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid session payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const meta = { ...(parsed.data.meta ?? {}) };
  let problemIds = parsed.data.problem_ids ?? [];

  if (problemIds.length === 0) {
    const auto = await autoSelectProblemIds(
      parsed.data.session_type,
      meta,
      repositories.problems.listSolveReady,
    );
    problemIds = auto.problemIds;
    meta.auto_problem_selection = true;
    meta.section_order = auto.sectionOrder;
    meta.section_bounds = auto.sectionBounds;
  }

  const session = await repositories.solve.createSession({
    ...parsed.data,
    problem_ids: problemIds,
    meta,
  });
  const runState = await repositories.solve.getSessionRunState(session.id);
  const solveContext = await repositories.solve.getSessionSolveContext(session.id);

  if (!runState || !solveContext) {
    return NextResponse.json({ error: "Session state unavailable" }, { status: 500 });
  }

  return NextResponse.json(
    sessionDetailResponseSchema.parse({
      session,
      run_state: runState,
      solve_context: solveContext,
    }),
    { status: 201 },
  );
}
