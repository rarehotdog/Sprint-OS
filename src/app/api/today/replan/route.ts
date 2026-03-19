import { NextResponse } from "next/server";

import {
  postTodayReplanResponseSchema,
  postTodayReplanSchema,
} from "@/lib/contracts/today-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = postTodayReplanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid today replan payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const replanned = await repositories.today.replan(parsed.data);
  return NextResponse.json(postTodayReplanResponseSchema.parse(replanned));
}
