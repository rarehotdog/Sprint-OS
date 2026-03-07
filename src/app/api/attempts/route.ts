import { NextResponse } from "next/server";

import { createAttemptSchema } from "@/lib/contracts/solve-contracts";
import { createAttempt, listAttempts } from "@/lib/server/solve-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? undefined;

  if (sessionId && !/^[0-9a-fA-F-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }

  return NextResponse.json({ attempts: listAttempts(sessionId) });
}

export async function POST(request: Request) {
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
    const attempt = createAttempt(parsed.data);
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
