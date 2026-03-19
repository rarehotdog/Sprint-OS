import { describe, expect, it } from "vitest";

import { POST } from "../src/app/api/problems/import/batch/route";
import { resetProblemsStoreForTests } from "../src/lib/server/problems-store";

function buildBatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/problems/import/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("problems batch import api", () => {
  it("imports text blocks into a needs_review batch with duplicate warnings", async () => {
    resetProblemsStoreForTests();

    const response = await POST(
      buildBatchRequest({
        input_type: "text",
        source_name: "Personal GMAT Notes",
        raw_payload: [
          "Section: verbal",
          "Subtype: cr_assumption",
          "Stem: Argument one",
          "A: choice 1",
          "B: choice 2",
          "C: choice 3",
          "D: choice 4",
          "E: choice 5",
          "Answer: B",
          "",
          "Section: verbal",
          "Subtype: cr_assumption",
          "Stem: Argument one",
          "A: choice 1",
          "B: choice 2",
          "C: choice 3",
          "D: choice 4",
          "E: choice 5",
          "Answer: B",
        ].join("\n"),
      }),
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      batch: { id: string; input_type: string; duplicate_rows: number };
      created_rows: number;
      invalid_rows: number;
      duplicate_rows: number;
      items: Array<{
        duplicate_count: number;
        review_status: string;
        problem: {
          import_batch_id: string | null;
          curation_status: string | null;
          corpus_tier: string | null;
          source_type: string | null;
          tags: string[];
        };
      }>;
    };

    expect(payload.created_rows).toBe(2);
    expect(payload.invalid_rows).toBe(0);
    expect(payload.duplicate_rows).toBe(2);
    expect(payload.batch.input_type).toBe("text");
    expect(payload.items[0]?.problem.import_batch_id).toBe(payload.batch.id);
    expect(payload.items[0]?.problem.curation_status).toBe("needs_review");
    expect(payload.items[0]?.problem.corpus_tier).toBe("gold");
    expect(payload.items[0]?.problem.source_type).toBe("manual");
    expect(payload.items[0]?.review_status).toBe("needs_review");
    expect(payload.items[0]?.duplicate_count).toBe(2);
    expect(payload.items[0]?.problem.tags).toContain("duplicate_candidate");
  });

  it("imports valid csv rows while surfacing invalid rows separately", async () => {
    resetProblemsStoreForTests();

    const response = await POST(
      buildBatchRequest({
        input_type: "csv",
        raw_payload: [
          "section,sub_type,stem,choice_a,choice_b,choice_c,choice_d,choice_e,answer,explanation,tags",
          "quant,algebra,If x+1=3,1,2,3,4,5,B,x=2,starter",
          "verbal,cr_inference,,A,B,C,D,E,A,missing stem,invalid",
        ].join("\n"),
      }),
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      created_rows: number;
      invalid_rows: number;
      errors: Array<{ row_number: number; message: string }>;
      items: Array<{ problem: { sub_type: string } }>;
    };

    expect(payload.created_rows).toBe(1);
    expect(payload.invalid_rows).toBe(1);
    expect(payload.errors[0]?.row_number).toBe(3);
    expect(payload.errors[0]?.message).toContain("section, sub_type, stem");
    expect(payload.items[0]?.problem.sub_type).toBe("algebra");
  });
});
