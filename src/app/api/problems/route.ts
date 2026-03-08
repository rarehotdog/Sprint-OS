import { NextResponse } from "next/server";

import {
  createProblemSchema,
  listProblemsResponseSchema,
  problemListQuerySchema,
} from "@/lib/contracts/problem-contracts";
import { createProblem, listProblems, listProblemsByIds } from "@/lib/server/problems-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = problemListQuerySchema.safeParse({
    section: url.searchParams.get("section") ?? undefined,
    problem_ids: url.searchParams.get("problem_ids") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid problems query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const problems =
    parsed.data.problem_ids.length > 0
      ? listProblemsByIds(parsed.data.problem_ids)
      : listProblems(parsed.data.section);

  return NextResponse.json(listProblemsResponseSchema.parse({ problems }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createProblemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid problem payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const problem = createProblem(parsed.data);
  return NextResponse.json({ problem }, { status: 201 });
}
