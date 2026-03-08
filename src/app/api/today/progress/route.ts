import { NextResponse } from "next/server";

import {
  postTodayProgressResponseSchema,
  postTodayProgressSchema,
} from "@/lib/contracts/today-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function POST(request: Request) {
  const repositories = getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = postTodayProgressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid today progress payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const updated = repositories.today.updateProgress(parsed.data);
    return NextResponse.json(postTodayProgressResponseSchema.parse(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Plan not found" || message === "Block not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
