import { describe, expect, it } from "vitest";

import { GET as getAttempts, POST as postAttempts } from "../src/app/api/attempts/route";
import { GET as getSessions, POST as postSessions } from "../src/app/api/sessions/route";
import { resetSolveStoreForTests } from "../src/lib/server/solve-store";

describe("sessions api", () => {
  it("creates and lists sessions", async () => {
    resetSolveStoreForTests();

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

    const listResponse = await getSessions();
    const listPayload = (await listResponse.json()) as { sessions: Array<{ id: string }> };
    expect(listPayload.sessions).toHaveLength(1);
    expect(listPayload.sessions[0]?.id).toBeTruthy();
  });
});

describe("attempts api", () => {
  it("returns 404 when session does not exist", async () => {
    resetSolveStoreForTests();

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
