import { beforeEach, describe, expect, it } from "vitest";

import { GET as getProblems, POST as postProblem } from "../src/app/api/problems/route";
import { resetProblemsStoreForTests } from "../src/lib/server/problems-store";

beforeEach(() => {
  resetProblemsStoreForTests();
});

describe("problems api", () => {
  it("creates and lists problems by section", async () => {
    const createVerbal = await postProblem(
      new Request("http://localhost/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "verbal",
          sub_type: "cr_inference",
          difficulty: "medium",
          content: { stem: "v1", choices: ["A", "B"], answer_index: 0 },
          tags: ["seed"],
          source: "manual_capture",
        }),
      }),
    );
    expect(createVerbal.status).toBe(201);

    await postProblem(
      new Request("http://localhost/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "quant",
          sub_type: "algebra",
          difficulty: "easy",
          content: { stem: "q1", choices: ["1", "2"], answer_index: 1 },
          tags: ["seed"],
          source: "manual_capture",
        }),
      }),
    );

    const response = await getProblems(
      new Request("http://localhost/api/problems?section=verbal"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      problems: Array<{ section: string; sub_type: string }>;
    };

    expect(payload.problems).toHaveLength(1);
    expect(payload.problems[0]?.section).toBe("verbal");
    expect(payload.problems[0]?.sub_type).toBe("cr_inference");
  });

  it("returns problems in explicit problem_ids order", async () => {
    const first = await postProblem(
      new Request("http://localhost/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "verbal",
          sub_type: "rc_detail",
          difficulty: "medium",
          content: { stem: "v1", choices: ["A", "B"], answer_index: 0 },
          tags: [],
          source: "manual_capture",
        }),
      }),
    );
    const second = await postProblem(
      new Request("http://localhost/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "quant",
          sub_type: "algebra",
          difficulty: "medium",
          content: { stem: "q1", choices: ["1", "2"], answer_index: 1 },
          tags: [],
          source: "manual_capture",
        }),
      }),
    );

    const firstPayload = (await first.json()) as { problem: { id: string } };
    const secondPayload = (await second.json()) as { problem: { id: string } };

    const response = await getProblems(
      new Request(
        `http://localhost/api/problems?problem_ids=${secondPayload.problem.id},${firstPayload.problem.id}`,
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      problems: Array<{ id: string }>;
    };

    expect(payload.problems.map((problem) => problem.id)).toEqual([
      secondPayload.problem.id,
      firstPayload.problem.id,
    ]);
  });

  it("rejects invalid problem_ids query", async () => {
    const response = await getProblems(
      new Request("http://localhost/api/problems?problem_ids=not-a-uuid"),
    );

    expect(response.status).toBe(400);
  });
});

