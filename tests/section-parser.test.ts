import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSectionHybrid } from "../src/lib/server/section-parser";

const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  vi.restoreAllMocks();
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_MODEL;
});

describe("section parser", () => {
  it("keeps rule result and marks needs_review for low confidence", async () => {
    const parsed = await parseSectionHybrid({
      stem: "Solve for x: x + 3 = 11",
      choices: ["5", "6", "7", "8", "9"],
    });

    expect(parsed.section).toBe("quant");
    expect(parsed.parser_mode).toBe("rule");
    expect(parsed.needs_review).toBe(true);
  });

  it("uses AI correction for ambiguous low-confidence input", async () => {
    env.OPENAI_API_KEY = "test-key";

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            section: "di",
            sub_type: "table_analysis",
            confidence: 0.9,
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const parsed = await parseSectionHybrid({
      stem: "Monthly sales values are listed for four periods. Which option best reflects the strongest increase?",
      choices: ["Jan", "Feb", "Mar", "Apr", "Cannot determine"],
    });

    expect(parsed.section).toBe("di");
    expect(parsed.sub_type).toBe("table_analysis");
    expect(parsed.parser_mode).toBe("ai_correction");
    expect(parsed.needs_review).toBe(false);
  });
});
