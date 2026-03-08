import { NextResponse } from "next/server";

import { reviewInboxResponseSchema } from "@/lib/contracts/review-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET() {
  const repositories = getServerRepositories();
  return NextResponse.json(reviewInboxResponseSchema.parse(repositories.review.getInbox()));
}

