import { NextResponse } from "next/server";

import {
  postTodayCheckinResponseSchema,
  postTodayCheckinSchema,
} from "@/lib/contracts/today-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function POST(request: Request) {
  const repositories = getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = postTodayCheckinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid today checkin payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const checkin = repositories.today.upsertCheckin(parsed.data);
  return NextResponse.json(postTodayCheckinResponseSchema.parse({ checkin }));
}
