import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/problems/generate/route";
import { resetProblemsStoreForTests } from "../src/lib/server/problems-store";

const env = process.env as Record<string, string | undefined>;

function buildGenerateRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/problems/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  resetProblemsStoreForTests();
  vi.restoreAllMocks();
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_MODEL;
});

describe("problems generate api", () => {
  it("rejects invalid payload", async () => {
    const response = await POST(buildGenerateRequest({ topic: "" }));
    expect(response.status).toBe(400);
  });

  it("supports count > 1 with mock fallback", async () => {
    const response = await POST(
      buildGenerateRequest({
        topic: "quant linear equations",
        section_hint: "quant",
        difficulty: "medium",
        count: 2,
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      items: Array<{
        problem: { source: string | null; tags: string[]; content: Record<string, unknown> };
        parser: { needs_review: boolean };
        generation_mode: string;
        generation_meta: { provider: string };
      }>;
      total: number;
    };

    expect(payload.total).toBe(2);
    expect(payload.items).toHaveLength(2);
    expect(payload.items.every((item) => item.generation_mode === "mock")).toBe(true);
    expect(payload.items.every((item) => item.generation_meta.provider === "mock")).toBe(true);
    expect(payload.items.every((item) => item.problem.source === "ai_generated")).toBe(true);
    expect(payload.items.every((item) => item.problem.tags.includes("ai_generated"))).toBe(true);
    expect(payload.items.every((item) => item.parser.needs_review)).toBe(true);
    expect(payload.items.every((item) => item.problem.tags.includes("needs_review"))).toBe(true);
  });

  it("uses OpenAI responses API when available", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-5.4";

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            items: [
              {
                stem: "Which choice most strengthens the argument?",
                choices: ["A", "B", "C", "D", "E"],
                answer_index: 3,
                explanation: "Choice D removes an alternative cause.",
              },
            ],
          }),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const response = await POST(
      buildGenerateRequest({
        topic: "CR strengthen",
        section_hint: "verbal",
        difficulty: "hard",
        count: 1,
        seed: 42,
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      items: Array<{
        generation_mode: string;
        generation_meta: { provider: string; seed: number | null; model: string };
        parser: { needs_review: boolean };
      }>;
      total: number;
      problem?: { id: string };
    };

    expect(payload.total).toBe(1);
    expect(payload.items[0]?.generation_mode).toBe("openai");
    expect(payload.items[0]?.generation_meta.provider).toBe("openai");
    expect(payload.items[0]?.generation_meta.seed).toBe(42);
    expect(payload.items[0]?.generation_meta.model).toBe("gpt-5.4");
    expect(payload.items[0]?.parser.needs_review).toBe(false);

    // Single-item backward compatibility for current UI consumer.
    expect(payload.problem?.id).toBeTruthy();
  });

  it("falls back to mock when OpenAI call fails", async () => {
    env.OPENAI_API_KEY = "test-key";
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("internal", { status: 500 }));

    const response = await POST(
      buildGenerateRequest({
        topic: "DI table analysis",
        section_hint: "di",
        count: 1,
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      items: Array<{ generation_mode: string; generation_meta: { provider: string } }>;
    };

    expect(payload.items[0]?.generation_mode).toBe("mock");
    expect(payload.items[0]?.generation_meta.provider).toBe("mock");
  });
});
