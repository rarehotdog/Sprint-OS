import { NextResponse } from "next/server";

import {
  knowledgeQuerySchema,
  listAnswerFlowsResponseSchema,
} from "@/lib/contracts/knowledge-contracts";
import { listAnswerFlows } from "@/lib/server/knowledge-stack-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = knowledgeQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid knowledge query",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const items = listAnswerFlows(parsed.data.limit);
  return NextResponse.json(
    listAnswerFlowsResponseSchema.parse({
      items,
      total: items.length,
    }),
  );
}
