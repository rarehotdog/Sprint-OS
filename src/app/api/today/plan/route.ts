import { NextResponse } from "next/server";

import {
  postTodayPlanResponseSchema,
  postTodayPlanSchema,
} from "@/lib/contracts/today-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function POST(request: Request) {
  const repositories = getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = postTodayPlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid today plan payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const built = repositories.today.generatePlan(parsed.data);
  return NextResponse.json(postTodayPlanResponseSchema.parse(built));
}
