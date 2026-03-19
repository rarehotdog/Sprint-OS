import { describe, expect, it } from "vitest";

import { GET, POST } from "../src/app/api/problems/review-status/route";
import { createProblem, resetProblemsStoreForTests } from "../src/lib/server/problems-store";

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/problems/review-status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("problems review-status api", () => {
  it("rejects invalid payload", async () => {
    resetProblemsStoreForTests();
    const response = await POST(buildRequest({ action: "accept" }));
    expect(response.status).toBe(400);
  });

  it("updates hold -> revise -> accept flow", async () => {
    resetProblemsStoreForTests();

    const created = createProblem({
      section: "quant",
      sub_type: "algebra",
      difficulty: "medium",
      content: {
        stem: "If x + 2 = 8, x = ?",
        choices: ["4", "5", "6", "7", "8"],
      },
      tags: ["needs_review", "manual_capture"],
      source: "manual_capture",
    });

    const held = await POST(
      buildRequest({
        problem_id: created.id,
        action: "hold",
        note: "needs manual verification",
      }),
    );
    expect(held.status).toBe(200);
    const heldPayload = (await held.json()) as {
      review_status: string;
      problem: { tags: string[]; content: Record<string, unknown> };
    };
    expect(heldPayload.review_status).toBe("needs_review");
    expect(heldPayload.problem.tags).toContain("on_hold");
    expect(heldPayload.problem.tags).toContain("needs_review");
    expect(String(heldPayload.problem.content.review_note)).toContain("manual verification");

    const revised = await POST(
      buildRequest({
        problem_id: created.id,
        action: "revise",
        section: "verbal",
        sub_type: "cr_inference",
        tags: ["curated"],
      }),
    );
    expect(revised.status).toBe(200);
    const revisedPayload = (await revised.json()) as {
      review_status: string;
      problem: { section: string; sub_type: string; tags: string[]; curation_status: string | null };
    };
    expect(revisedPayload.review_status).toBe("needs_review");
    expect(revisedPayload.problem.curation_status).toBe("needs_review");
    expect(revisedPayload.problem.section).toBe("verbal");
    expect(revisedPayload.problem.sub_type).toBe("cr_inference");
    expect(revisedPayload.problem.tags).toContain("curated");

    const accepted = await POST(
      buildRequest({
        problem_id: created.id,
        action: "accept",
      }),
    );
    expect(accepted.status).toBe(200);
    const acceptedPayload = (await accepted.json()) as {
      review_status: string;
      problem: { curation_status: string | null };
    };
    expect(acceptedPayload.review_status).toBe("accepted");
    expect(acceptedPayload.problem.curation_status).toBe("accepted");
  });

  it("lists and filters review queue items", async () => {
    resetProblemsStoreForTests();

    const p1 = createProblem({
      section: "verbal",
      sub_type: "cr_inference",
      difficulty: "medium",
      content: {
        stem: "CR question",
        choices: ["A", "B", "C", "D", "E"],
        generation_meta: {
          provider: "mock",
          model: "mock-gmat-v1",
          prompt_version: "v1",
          seed: null,
          generated_at: new Date().toISOString(),
          parser: {
            section: "verbal",
            sub_type: "cr_inference",
            confidence: 0.88,
            parser_mode: "rule",
            needs_review: false,
          },
        },
      },
      tags: ["accepted", "ai_generated"],
      source: "ai_generated",
      source_type: "generated",
      curation_status: "accepted",
      corpus_tier: "filler",
    });

    const p2 = createProblem({
      section: "quant",
      sub_type: "algebra",
      difficulty: "easy",
      content: {
        stem: "Quant question",
        choices: ["1", "2", "3", "4", "5"],
      },
      tags: ["needs_review", "manual_capture", "on_hold"],
      source: "manual_capture",
      source_type: "manual",
      curation_status: "needs_review",
      corpus_tier: "gold",
    });

    const listAll = await GET(
      new Request("http://localhost/api/problems/review-status?limit=10"),
    );
    expect(listAll.status).toBe(200);
    const allPayload = (await listAll.json()) as {
      total: number;
      items: Array<{ problem: { id: string }; review_status: string }>;
    };
    expect(allPayload.total).toBe(2);
    expect(allPayload.items).toHaveLength(2);

    const needsReviewOnly = await GET(
      new Request(
        "http://localhost/api/problems/review-status?review_status=needs_review&source=manual_capture",
      ),
    );
    expect(needsReviewOnly.status).toBe(200);
    const filteredPayload = (await needsReviewOnly.json()) as {
      total: number;
      items: Array<{ problem: { id: string }; review_status: string }>;
      filters_applied: { review_status: string | null; source: string | null };
    };
    expect(filteredPayload.total).toBe(1);
    expect(filteredPayload.items).toHaveLength(1);
    expect(filteredPayload.items[0]?.problem.id).toBe(p2.id);
    expect(filteredPayload.items[0]?.review_status).toBe("needs_review");
    expect(filteredPayload.filters_applied.review_status).toBe("needs_review");
    expect(filteredPayload.filters_applied.source).toBe("manual_capture");

    const detail = await GET(
      new Request(`http://localhost/api/problems/review-status?problem_id=${p1.id}`),
    );
    expect(detail.status).toBe(200);
    const detailPayload = (await detail.json()) as {
      problem: { id: string };
      parser: { section: string } | null;
      review_status: string;
    };
    expect(detailPayload.problem.id).toBe(p1.id);
    expect(detailPayload.review_status).toBe("accepted");
    expect(detailPayload.parser?.section).toBe("verbal");
  });
});
