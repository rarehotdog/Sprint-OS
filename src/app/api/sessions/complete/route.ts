import { NextResponse } from "next/server";

import { completeSessionSchema, sessionDetailResponseSchema } from "@/lib/contracts/solve-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = completeSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid complete session payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const session = await repositories.solve.completeSession(parsed.data);
    const runState = await repositories.solve.getSessionRunState(session.id);
    const solveContext = await repositories.solve.getSessionSolveContext(session.id);
    if (!runState || !solveContext) {
      return NextResponse.json({ error: "Session state unavailable" }, { status: 500 });
    }

    return NextResponse.json(sessionDetailResponseSchema.parse({
      session,
      run_state: runState,
      solve_context: solveContext,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
