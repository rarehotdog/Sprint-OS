import { describe, expect, it } from "vitest";

import { GET as getAttempts, POST as postAttempts } from "../src/app/api/attempts/route";
import { POST as postSessionComplete } from "../src/app/api/sessions/complete/route";
import { GET as getSessions, POST as postSessions } from "../src/app/api/sessions/route";
import { createProblem, resetProblemsStoreForTests } from "../src/lib/server/problems-store";
import { resetSolveStoreForTests } from "../src/lib/server/solve-store";

describe("sessions api", () => {
  it("creates and lists sessions", async () => {
    resetSolveStoreForTests();
    resetProblemsStoreForTests();

    const createRequest = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_type: "sprint_verbal",
        recipe: "v-cr",
        duration_planned_min: 60,
        meta: { source: "test" },
      }),
    });

    const created = await postSessions(createRequest);
    expect(created.status).toBe(201);

    const listResponse = await getSessions(
      new Request("http://localhost/api/sessions"),
    );
    const listPayload = (await listResponse.json()) as { sessions: Array<{ id: string }> };
    expect(listPayload.sessions).toHaveLength(1);
    expect(listPayload.sessions[0]?.id).toBeTruthy();
  });

  it("returns run_state and supports completion", async () => {
    resetSolveStoreForTests();
    resetProblemsStoreForTests();
    const p1 = crypto.randomUUID();
    const p2 = crypto.randomUUID();

    const created = await postSessions(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_type: "mock_section",
          duration_planned_min: 45,
          problem_ids: [p1, p2],
        }),
      }),
    );

    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as {
      session: { id: string };
      run_state: { total_count: number; current_index: number; next_problem_id: string | null };
      solve_context: {
        section_hint: string | null;
        duration_planned_min: number;
        section_order: string[];
        section_bounds: Array<{ section: string; start_index: number; end_index: number }>;
      };
    };
    const sessionId = createdPayload.session.id;
    expect(createdPayload.run_state.total_count).toBe(2);
    expect(createdPayload.run_state.current_index).toBe(0);
    expect(createdPayload.run_state.next_problem_id).toBe(p1);
    expect(createdPayload.solve_context.duration_planned_min).toBe(45);

    await postAttempts(
      new Request("http://localhost/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem_id: p1,
          session_id: sessionId,
          user_answer: 1,
          is_correct: false,
          time_spent_sec: 90,
        }),
      }),
    );

    const details = await getSessions(
      new Request(`http://localhost/api/sessions?session_id=${sessionId}`),
    );
    expect(details.status).toBe(200);
    const detailPayload = (await details.json()) as {
      run_state: { current_index: number; next_problem_id: string | null; completed: boolean };
      solve_context: {
        section_hint: string | null;
        duration_planned_min: number;
        section_order: string[];
        section_bounds: Array<{ section: string; start_index: number; end_index: number }>;
      };
    };
    expect(detailPayload.run_state.current_index).toBe(1);
    expect(detailPayload.run_state.next_problem_id).toBe(p2);
    expect(detailPayload.run_state.completed).toBe(false);
    expect(detailPayload.solve_context.duration_planned_min).toBe(45);
    expect(Array.isArray(detailPayload.solve_context.section_order)).toBe(true);

    const completed = await postSessionComplete(
      new Request("http://localhost/api/sessions/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      }),
    );
    expect(completed.status).toBe(200);
    const completedPayload = (await completed.json()) as {
      session: { completed_at: string | null; duration_actual_min: number | null };
      run_state: { completed: boolean; next_problem_id: string | null; current_index: number };
      solve_context: { duration_planned_min: number };
    };
    expect(completedPayload.session.completed_at).toBeTruthy();
    expect((completedPayload.session.duration_actual_min ?? 0) >= 1).toBe(true);
    expect(completedPayload.run_state.completed).toBe(true);
    expect(completedPayload.run_state.next_problem_id).toBeNull();
    expect(completedPayload.run_state.current_index).toBe(0);
    expect(completedPayload.solve_context.duration_planned_min).toBe(45);
  });

  it("auto-selects ordered problem ids when omitted", async () => {
    resetSolveStoreForTests();
    resetProblemsStoreForTests();

    const verbal = createProblem({
      section: "verbal",
      sub_type: "cr_inference",
      difficulty: "easy",
      content: { stem: "v1", choices: ["A", "B"] },
      tags: ["seed"],
      source: "manual_capture",
    });
    createProblem({
      section: "quant",
      sub_type: "algebra",
      difficulty: "easy",
      content: { stem: "q1", choices: ["1", "2"] },
      tags: ["seed"],
      source: "manual_capture",
    });

    const created = await postSessions(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_type: "sprint_verbal",
          duration_planned_min: 30,
          meta: { section: "verbal" },
        }),
      }),
    );

    expect(created.status).toBe(201);
    const payload = (await created.json()) as {
      session: { meta: Record<string, unknown> };
      run_state: { ordered_problem_ids: string[] };
      solve_context: {
        section_hint: string | null;
        duration_planned_min: number;
        section_order: string[];
        section_bounds: Array<{ section: string; start_index: number; end_index: number }>;
      };
    };
    expect(payload.run_state.ordered_problem_ids.length).toBeGreaterThan(0);
    expect(payload.run_state.ordered_problem_ids).toContain(verbal.id);
    expect(payload.session.meta.auto_problem_selection).toBe(true);
    expect(Array.isArray(payload.session.meta.section_bounds)).toBe(true);
    expect(payload.solve_context.section_hint).toBe("verbal");
    expect(payload.solve_context.duration_planned_min).toBe(30);
    expect(payload.solve_context.section_order).toEqual(["verbal"]);
    expect(payload.solve_context.section_bounds[0]).toMatchObject({
      section: "verbal",
      start_index: 0,
    });
  });

  it("marks run_state completed after the final attempt without needing manual completion", async () => {
    resetSolveStoreForTests();
    resetProblemsStoreForTests();
    const p1 = crypto.randomUUID();
    const p2 = crypto.randomUUID();

    const created = await postSessions(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_type: "mock_section",
          duration_planned_min: 45,
          problem_ids: [p1, p2],
        }),
      }),
    );
    const createdPayload = (await created.json()) as { session: { id: string } };
    const sessionId = createdPayload.session.id;

    await postAttempts(
      new Request("http://localhost/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem_id: p1,
          session_id: sessionId,
          user_answer: 1,
          is_correct: false,
          time_spent_sec: 60,
        }),
      }),
    );

    const secondAttempt = await postAttempts(
      new Request("http://localhost/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem_id: p2,
          session_id: sessionId,
          user_answer: 2,
          is_correct: true,
          time_spent_sec: 55,
        }),
      }),
    );

    expect(secondAttempt.status).toBe(201);
    const payload = (await secondAttempt.json()) as {
      run_state: { completed: boolean; next_problem_id: string | null; current_index: number };
    };

    expect(payload.run_state.completed).toBe(true);
    expect(payload.run_state.next_problem_id).toBeNull();
    expect(payload.run_state.current_index).toBe(1);
  });
});

describe("attempts api", () => {
  it("returns 404 when session does not exist", async () => {
    resetSolveStoreForTests();
    resetProblemsStoreForTests();

    const createRequest = new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        problem_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        user_answer: 1,
        is_correct: false,
        time_spent_sec: 120,
      }),
    });

    const response = await postAttempts(createRequest);
    expect(response.status).toBe(404);
  });

  it("creates and filters attempts by session", async () => {
    resetSolveStoreForTests();
    resetProblemsStoreForTests();

    const createSessionRequest = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_type: "mock_section",
        duration_planned_min: 45,
      }),
    });

    const sessionResponse = await postSessions(createSessionRequest);
    const sessionPayload = (await sessionResponse.json()) as { session: { id: string } };
    const sessionId = sessionPayload.session.id;

    const createAttemptRequest = new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        problem_id: crypto.randomUUID(),
        session_id: sessionId,
        user_answer: 4,
        is_correct: true,
        time_spent_sec: 88,
        confidence: "sure",
      }),
    });

    const attemptResponse = await postAttempts(createAttemptRequest);
    expect(attemptResponse.status).toBe(201);
    const attemptPayload = (await attemptResponse.json()) as {
      attempt: { session_id: string };
      run_state: { session_id: string };
    };
    expect(attemptPayload.attempt.session_id).toBe(sessionId);
    expect(attemptPayload.run_state.session_id).toBe(sessionId);

    const filtered = await getAttempts(
      new Request(`http://localhost/api/attempts?session_id=${sessionId}`),
    );

    const payload = (await filtered.json()) as {
      attempts: Array<{ session_id: string }>;
    };

    expect(payload.attempts).toHaveLength(1);
    expect(payload.attempts[0]?.session_id).toBe(sessionId);
  });
});
