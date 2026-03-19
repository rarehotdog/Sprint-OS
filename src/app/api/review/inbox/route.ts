import { NextResponse } from "next/server";

import { reviewInboxResponseSchema } from "@/lib/contracts/review-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET() {
  const repositories = await getServerRepositories();
  return NextResponse.json(reviewInboxResponseSchema.parse(await repositories.review.getInbox()));
}
