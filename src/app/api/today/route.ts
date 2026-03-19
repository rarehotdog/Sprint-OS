import { NextResponse } from "next/server";

import { todayQuerySchema, todaySnapshotSchema } from "@/lib/contracts/today-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET(request: Request) {
  const repositories = await getServerRepositories();
  const url = new URL(request.url);

  const parsed = todayQuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid today query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const snapshot = await repositories.today.getSnapshot(parsed.data.date);
  return NextResponse.json(todaySnapshotSchema.parse(snapshot));
}
