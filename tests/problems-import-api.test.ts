import { describe, expect, it } from "vitest";

import { POST } from "../src/app/api/problems/import/route";
import { resetProblemsStoreForTests } from "../src/lib/server/problems-store";

function buildImportRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/problems/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("problems import api", () => {
  it("rejects invalid payload", async () => {
    resetProblemsStoreForTests();

    const response = await POST(
      buildImportRequest({
        stem: "If x + 1 = 2, x = ?",
        choices: ["0", "1"],
        sub_type: "algebra",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("imports manual capture and preserves explicit section/sub_type", async () => {
    resetProblemsStoreForTests();

    const response = await POST(
      buildImportRequest({
        stem: "If x + 1 = 2, x = ?",
        choices: ["0", "1", "2", "3", "4"],
        section: "verbal",
        sub_type: "cr_inference",
        difficulty: "easy",
        answer_index: 1,
        explanation: "x=1",
        tags: ["uploaded", "custom"],
        image_ref: "capture://img-001",
      }),
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as {
      problem: {
        section: string;
        sub_type: string;
        source: string | null;
        source_type: string | null;
        curation_status: string | null;
        corpus_tier: string | null;
        tags: string[];
        content: Record<string, unknown>;
      };
      review_status: string;
    };

    expect(payload.problem.section).toBe("verbal");
    expect(payload.problem.sub_type).toBe("cr_inference");
    expect(payload.problem.source).toBe("manual_capture");
    expect(payload.problem.source_type).toBe("manual");
    expect(payload.problem.curation_status).toBe("accepted");
    expect(payload.problem.corpus_tier).toBe("gold");
    expect(payload.review_status).toBe("accepted");
    expect(payload.problem.tags).toContain("uploaded");
    expect(payload.problem.tags).toContain("cr_inference");

    const importMeta = payload.problem.content.import_meta as {
      parser?: { section?: string; confidence?: number; needs_review?: boolean };
    };

    expect(importMeta.parser?.section).toBe("quant");
    expect(typeof importMeta.parser?.confidence).toBe("number");
    expect(importMeta.parser?.needs_review).toBe(true);
    expect(payload.problem.tags).toContain("needs_review");
  });
});
