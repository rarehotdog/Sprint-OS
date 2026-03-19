import { NextResponse } from "next/server";

import {
  createProblemSchema,
  listProblemsResponseSchema,
  problemListQuerySchema,
} from "@/lib/contracts/problem-contracts";
import { getServerRepositories } from "@/lib/server/persistence/repositories";

export async function GET(request: Request) {
  const repositories = await getServerRepositories();
  const url = new URL(request.url);
  const parsed = problemListQuerySchema.safeParse({
    section: url.searchParams.get("section") ?? undefined,
    solve_ready: url.searchParams.get("solve_ready") ?? undefined,
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
      ? await repositories.problems.listByIds(parsed.data.problem_ids)
      : parsed.data.solve_ready
        ? await repositories.problems.listSolveReady(parsed.data.section)
        : await repositories.problems.list(parsed.data.section);

  return NextResponse.json(listProblemsResponseSchema.parse({ problems }));
}

export async function POST(request: Request) {
  const repositories = await getServerRepositories();
  const body = await request.json().catch(() => null);
  const parsed = createProblemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid problem payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const problem = await repositories.problems.create(parsed.data);
  return NextResponse.json({ problem }, { status: 201 });
}
