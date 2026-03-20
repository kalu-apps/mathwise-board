#!/usr/bin/env node

const baseUrl = String(process.env.PHASE4_BASE_URL ?? "http://127.0.0.1:4173")
  .trim()
  .replace(/\/+$/, "");

const readRequiredEnv = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (value.length > 0) return value;
  throw new Error(`[phase4] Missing required env variable: ${name}`);
};

const loginEmail = String(process.env.PHASE4_LOGIN_EMAIL ?? "teacher@axiom.demo").trim();
const loginPassword = readRequiredEnv("PHASE4_LOGIN_PASSWORD");

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return {
    status: response.status,
    headers: response.headers,
    json,
  };
};

const ensure = (condition, message, payload = null) => {
  if (condition) return;
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        payload,
      },
      null,
      2
    )
  );
  process.exit(1);
};

const cookieHeaderFromResponse = (response) => {
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length === 0) return "";
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
};

const buildCreateObjectEvent = (objectId) => ({
  clientEventId: `phase4-create-${objectId}`,
  type: "board.object.create",
  payload: {
    object: {
      id: objectId,
      type: "shape",
      shapeType: "rect",
      x: 120,
      y: 80,
      width: 100,
      height: 60,
      page: 1,
      layer: "board",
      color: "#3f51b5",
      strokeWidth: 2,
      authorUserId: "phase4-check",
      createdAt: new Date().toISOString(),
    },
    expectedVersion: 0,
  },
});

const buildUpdateObjectEvent = (objectId, expectedVersion) => ({
  clientEventId: `phase4-update-${objectId}-${expectedVersion}-${Date.now()}`,
  type: "board.object.update",
  payload: {
    objectId,
    expectedVersion,
    patch: {
      x: 150,
      y: 95,
    },
  },
});

const run = async () => {
  const loginResponse = await requestJson("/api/auth/password/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      email: loginEmail,
      password: loginPassword,
    }),
  });
  ensure(loginResponse.status === 200, "phase4_login_failed", loginResponse.json);
  const cookie = cookieHeaderFromResponse(loginResponse);
  ensure(cookie.length > 0, "phase4_cookie_not_set");

  const createSessionResponse = await requestJson("/api/workbook/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Cookie: cookie,
    },
    body: JSON.stringify({
      kind: "CLASS",
      title: "Phase4 consistency check",
    }),
  });
  ensure(createSessionResponse.status === 200, "phase4_create_session_failed", createSessionResponse.json);
  const sessionId = createSessionResponse.json?.session?.id;
  ensure(typeof sessionId === "string" && sessionId.length > 0, "phase4_session_id_missing");

  const openResponse = await requestJson(`/api/workbook/sessions/${encodeURIComponent(sessionId)}/open`, {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
  });
  ensure(openResponse.status === 200, "phase4_open_session_failed", openResponse.json);

  const objectId = `phase4-object-${Date.now()}`;
  const idempotencyKey = `phase4-idempotency-${sessionId}`;
  const createPayload = {
    events: [buildCreateObjectEvent(objectId)],
  };

  const createEventResponse = await requestJson(
    `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Cookie: cookie,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(createPayload),
    }
  );
  ensure(createEventResponse.status === 200, "phase4_create_event_failed", createEventResponse.json);
  const firstLatestSeq = Number(createEventResponse.json?.latestSeq ?? 0);
  ensure(Number.isFinite(firstLatestSeq) && firstLatestSeq > 0, "phase4_latest_seq_missing");

  const createEventReplayResponse = await requestJson(
    `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Cookie: cookie,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(createPayload),
    }
  );
  ensure(
    createEventReplayResponse.status === 200,
    "phase4_idempotency_replay_failed",
    createEventReplayResponse.json
  );
  const replayLatestSeq = Number(createEventReplayResponse.json?.latestSeq ?? 0);
  ensure(replayLatestSeq === firstLatestSeq, "phase4_idempotency_seq_mismatch", {
    firstLatestSeq,
    replayLatestSeq,
  });

  const updateEventResponse = await requestJson(
    `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Cookie: cookie,
      },
      body: JSON.stringify({
        events: [buildUpdateObjectEvent(objectId, 1)],
      }),
    }
  );
  ensure(updateEventResponse.status === 200, "phase4_update_event_failed", updateEventResponse.json);
  const secondLatestSeq = Number(updateEventResponse.json?.latestSeq ?? 0);
  ensure(secondLatestSeq > firstLatestSeq, "phase4_update_seq_not_advanced", {
    firstLatestSeq,
    secondLatestSeq,
  });

  const staleUpdateResponse = await requestJson(
    `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Cookie: cookie,
      },
      body: JSON.stringify({
        events: [buildUpdateObjectEvent(objectId, 1)],
      }),
    }
  );
  ensure(staleUpdateResponse.status === 409, "phase4_stale_expected_version_not_rejected", staleUpdateResponse.json);

  const snapshotResponse = await requestJson(
    `/api/workbook/sessions/${encodeURIComponent(sessionId)}/snapshot`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Cookie: cookie,
      },
      body: JSON.stringify({
        layer: "board",
        version: secondLatestSeq,
        payload: {
          phase4: true,
        },
      }),
    }
  );
  ensure(snapshotResponse.status === 200, "phase4_snapshot_failed", snapshotResponse.json);

  const diagnosticsResponse = await requestJson("/api/nest/write/diagnostics", {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  });
  ensure(
    diagnosticsResponse.status === 200,
    "phase4_write_diagnostics_unavailable",
    diagnosticsResponse.json
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        sessionId,
        firstLatestSeq,
        secondLatestSeq,
        staleStatus: staleUpdateResponse.status,
        diagnostics: diagnosticsResponse.json,
      },
      null,
      2
    )
  );
};

void run();
