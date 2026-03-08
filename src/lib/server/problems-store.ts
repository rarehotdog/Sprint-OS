import {
  parsedSectionResultSchema,
} from "@/lib/contracts/problem-contracts";
import type {
  CreateProblemInput,
  ParsedSectionResult,
  UpdateProblemReviewStatusInput,
} from "@/lib/contracts/problem-contracts";
import type { Problem, ReviewStatus } from "@/lib/types";

interface ProblemsDb {
  problems: Map<string, Problem>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatProblemsDb__: ProblemsDb | undefined;
}

function getDb(): ProblemsDb {
  if (!global.__gmatProblemsDb__) {
    global.__gmatProblemsDb__ = {
      problems: new Map<string, Problem>(),
    };
  }
  return global.__gmatProblemsDb__;
}

function now(): string {
  return new Date().toISOString();
}

export function listProblems(section?: Problem["section"]): Problem[] {
  const all = Array.from(getDb().problems.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  if (!section) return all;
  return all.filter((item) => item.section === section);
}

export function listProblemsByIds(problemIds: string[]): Problem[] {
  const uniqueIds = Array.from(new Set(problemIds));
  return uniqueIds
    .map((problemId) => getProblemById(problemId))
    .filter((problem): problem is Problem => problem !== null);
}

export function createProblem(input: CreateProblemInput): Problem {
  const created: Problem = {
    id: crypto.randomUUID(),
    section: input.section,
    sub_type: input.sub_type,
    difficulty: input.difficulty ?? null,
    content: input.content,
    tags: input.tags ?? [],
    source: input.source ?? "manual_capture",
    created_at: now(),
  };

  getDb().problems.set(created.id, created);
  return created;
}

export function getProblemById(problemId: string): Problem | null {
  return getDb().problems.get(problemId) ?? null;
}

export function getProblemReviewStatus(problem: Problem): ReviewStatus {
  const tagSet = new Set(problem.tags);
  if (tagSet.has("needs_review") || tagSet.has("on_hold")) {
    return "needs_review";
  }

  return "accepted";
}

export interface ProblemReviewItem {
  problem: Problem;
  parser: ParsedSectionResult | null;
  review_status: ReviewStatus;
}

function getProblemParser(problem: Problem): ParsedSectionResult | null {
  const content = problem.content as {
    generation_meta?: { parser?: unknown };
    import_meta?: { parser?: unknown };
  };
  const candidate = content.generation_meta?.parser ?? content.import_meta?.parser;
  const parsed = parsedSectionResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function getProblemReviewItem(problemId: string): ProblemReviewItem | null {
  const problem = getProblemById(problemId);
  if (!problem) {
    return null;
  }

  return {
    problem,
    parser: getProblemParser(problem),
    review_status: getProblemReviewStatus(problem),
  };
}

export interface ListProblemReviewFilters {
  review_status?: ReviewStatus;
  section?: Problem["section"];
  source?: string;
  tag?: string;
  limit: number;
}

export function listProblemReviewItems(filters: ListProblemReviewFilters): {
  items: ProblemReviewItem[];
  total: number;
} {
  const sourceFiltered = listProblems().filter((problem) => {
    if (filters.section && problem.section !== filters.section) {
      return false;
    }

    if (filters.source && problem.source !== filters.source) {
      return false;
    }

    if (filters.tag && !problem.tags.includes(filters.tag)) {
      return false;
    }

    return true;
  });

  const mapped = sourceFiltered.map((problem) => ({
    problem,
    parser: getProblemParser(problem),
    review_status: getProblemReviewStatus(problem),
  }));

  const statusFiltered = mapped.filter((item) => {
    if (!filters.review_status) {
      return true;
    }

    return item.review_status === filters.review_status;
  });

  return {
    total: statusFiltered.length,
    items: statusFiltered.slice(0, filters.limit),
  };
}

export function updateProblemReviewStatus(input: UpdateProblemReviewStatusInput): {
  problem: Problem;
  parser: ParsedSectionResult | null;
  review_status: ReviewStatus;
} {
  const found = getProblemById(input.problem_id);
  if (!found) {
    throw new Error("Problem not found");
  }

  const tagSet = new Set(found.tags);
  tagSet.delete("accepted");
  tagSet.delete("on_hold");

  const nextContent: Record<string, unknown> = { ...found.content };
  if (input.note && input.note.trim().length > 0) {
    nextContent.review_note = input.note.trim();
  }

  if (input.action === "accept") {
    tagSet.delete("needs_review");
    tagSet.add("accepted");
  } else if (input.action === "hold") {
    tagSet.add("on_hold");
    tagSet.add("needs_review");
  } else {
    if (input.section) {
      found.section = input.section;
    }
    if (input.sub_type) {
      found.sub_type = input.sub_type;
      tagSet.add(input.sub_type);
    }
    if (input.tags) {
      for (const tag of input.tags) {
        tagSet.add(tag);
      }
    }
    tagSet.delete("needs_review");
    tagSet.add("accepted");
  }

  const updated: Problem = {
    ...found,
    section: found.section,
    sub_type: found.sub_type,
    content: nextContent,
    tags: Array.from(tagSet),
  };

  getDb().problems.set(updated.id, updated);
  return {
    problem: updated,
    parser: getProblemParser(updated),
    review_status: getProblemReviewStatus(updated),
  };
}

export function resetProblemsStoreForTests(): void {
  global.__gmatProblemsDb__ = {
    problems: new Map<string, Problem>(),
  };
}
