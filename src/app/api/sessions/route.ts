import { NextResponse } from "next/server";

import { createSessionSchema } from "@/lib/contracts/solve-contracts";
import { createSession, listSessions } from "@/lib/server/solve-store";

export async function GET() {
  return NextResponse.json({ sessions: listSessions() });
}

export async function POST(request: Request) {
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

  const session = createSession(parsed.data);
  return NextResponse.json({ session }, { status: 201 });
}
