import type { Problem, Section } from "@/lib/types";

export interface ProblemInventoryCounts {
  total: number;
  verbal: number;
  quant: number;
  di: number;
}

export function isProblemSection(value: string | null | undefined): value is Section {
  return value === "verbal" || value === "quant" || value === "di";
}

export function parseProblemSection(
  value: string | null | undefined,
  fallback: Section = "verbal",
): Section {
  return isProblemSection(value) ? value : fallback;
}

export function createEmptyProblemInventory(): ProblemInventoryCounts {
  return {
    total: 0,
    verbal: 0,
    quant: 0,
    di: 0,
  };
}

export function countProblemsBySection(problems: Problem[]): ProblemInventoryCounts {
  return problems.reduce<ProblemInventoryCounts>((counts, problem) => {
    counts.total += 1;
    counts[problem.section] += 1;
    return counts;
  }, createEmptyProblemInventory());
}

export function buildProblemsWorkbenchHref(section: Section | null): string {
  if (!section) {
    return "/problems";
  }

  return `/problems?section=${encodeURIComponent(section)}`;
}

export function buildStarterGeneratePayload(section: Section): {
  topic: string;
  section_hint: Section;
  difficulty: "medium";
  count: 3;
} {
  if (section === "quant") {
    return {
      topic: "GMAT quant starter sprint",
      section_hint: "quant",
      difficulty: "medium",
      count: 3,
    };
  }

  if (section === "di") {
    return {
      topic: "GMAT data insights starter sprint",
      section_hint: "di",
      difficulty: "medium",
      count: 3,
    };
  }

  return {
    topic: "GMAT verbal starter sprint",
    section_hint: "verbal",
    difficulty: "medium",
    count: 3,
  };
}

export function getDefaultImportSubType(section: Section): string {
  if (section === "quant") {
    return "algebra";
  }

  if (section === "di") {
    return "table_analysis";
  }

  return "cr_strengthen";
}

export function parseChoicesInput(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
