import { describe, expect, it } from "vitest";

import {
  buildProblemsWorkbenchHref,
  buildStarterGeneratePayload,
  countProblemsBySection,
  getDefaultImportSubType,
  parseChoicesInput,
  parseProblemSection,
} from "../src/lib/problems-ui";
import type { Problem } from "../src/lib/types";

function makeProblem(id: string, section: "verbal" | "quant" | "di"): Problem {
  return {
    id,
    section,
    sub_type: `${section}_type`,
    difficulty: "medium",
    content: {
      stem: `${section} stem`,
      choices: ["A", "B"],
    },
    tags: [],
    source: "test",
    source_type: "manual",
    source_name: "Test Bank",
    source_url: null,
    external_id: null,
    license_note: null,
    parser_confidence: null,
    curation_status: "accepted",
    corpus_tier: "gold",
    canonical_hash: null,
    difficulty_estimate: "medium",
    explanation_quality: null,
    import_batch_id: null,
    last_curated_at: null,
    curated_by: null,
    created_at: new Date().toISOString(),
  };
}

describe("problems ui helpers", () => {
  it("preselects requested section with verbal fallback", () => {
    expect(parseProblemSection("quant")).toBe("quant");
    expect(parseProblemSection("weird")).toBe("verbal");
  });

  it("builds starter generation payload for the selected section", () => {
    expect(buildStarterGeneratePayload("quant")).toEqual({
      topic: "GMAT quant starter sprint",
      section_hint: "quant",
      difficulty: "medium",
      count: 3,
    });
    expect(getDefaultImportSubType("di")).toBe("table_analysis");
  });

  it("counts inventory and prepares workbench hrefs", () => {
    const inventory = countProblemsBySection([
      makeProblem("1", "verbal"),
      makeProblem("2", "quant"),
      makeProblem("3", "quant"),
    ]);

    expect(inventory.total).toBe(3);
    expect(inventory.quant).toBe(2);
    expect(buildProblemsWorkbenchHref("verbal")).toBe("/problems?section=verbal");
    expect(parseChoicesInput("A\n\nB\n C ")).toEqual(["A", "B", "C"]);
  });
});
