import { NextResponse } from "next/server";

import { createAttemptSchema } from "@/lib/contracts/solve-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET(request: Request) {
  const repositories = await getServerRepositories();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? undefined;

  if (sessionId && !/^[0-9a-fA-F-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }

  return NextResponse.json({ attempts: await repositories.solve.listAttempts(sessionId) });
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = createAttemptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid attempt payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const attempt = await repositories.solve.createAttempt(parsed.data);
    return NextResponse.json(
      {
        attempt,
        run_state: await repositories.solve.getSessionRunState(parsed.data.session_id),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
