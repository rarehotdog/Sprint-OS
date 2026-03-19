import { NextResponse } from "next/server";

import {
  knowledgeQuerySchema,
  listSummaryCardsResponseSchema,
} from "@/lib/contracts/knowledge-contracts";
import { ensureCanonicalStateLoaded } from "@/lib/server/persistence/repositories";
import { listSummaryCards } from "@/lib/server/knowledge-stack-store";

export async function GET(request: Request) {
  await ensureCanonicalStateLoaded();
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

  const items = listSummaryCards(parsed.data.limit);
  const normalized = items.map((item) => ({
    id: item.id,
    card_type: item.card_type,
    content: item.content,
    inclusion_score: item.inclusion_score,
    source_report_id: item.source_report_id,
    source_rule_id: item.source_rule_id,
  }));
  return NextResponse.json(
    listSummaryCardsResponseSchema.parse({
      items: normalized,
      total: normalized.length,
    }),
  );
}
