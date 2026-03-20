#!/usr/bin/env node

import WebSocket from "ws";

const readPositiveInt = (value, fallback, cap) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

const readRequiredEnv = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (value.length > 0) return value;
  throw new Error(`[phase-critical] Missing required env variable: ${name}`);
};

const baseUrl = String(process.env.PHASE_CRITICAL_BASE_URL ?? "https://api.board.mathwise.ru")
  .trim()
  .replace(/\/+$/, "");
const teacherEmail = String(process.env.PHASE_CRITICAL_TEACHER_EMAIL ?? "teacher@axiom.demo").trim();
const teacherPassword = readRequiredEnv("PHASE_CRITICAL_TEACHER_PASSWORD");
const studentName = String(process.env.PHASE_CRITICAL_STUDENT_NAME ?? "Student E2E").trim();
const timeoutMs = readPositiveInt(process.env.PHASE_CRITICAL_TIMEOUT_MS, 20_000, 120_000);
const wsTimeoutMs = readPositiveInt(process.env.PHASE_CRITICAL_WS_TIMEOUT_MS, 12_000, 120_000);

const nowIso = () => new Date().toISOString();

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const withTimeout = async (task, timeout) => {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeout);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timerId);
  }
};

const parseSetCookies = (headers) => {
  const fromNode = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (Array.isArray(fromNode) && fromNode.length > 0) {
    return fromNode
      .map((entry) => String(entry).split(";")[0]?.trim())
      .filter((entry) => Boolean(entry));
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw
    .split(/,(?=[^;]+=[^;]+)/)
    .map((entry) => entry.split(";")[0]?.trim())
    .filter((entry) => Boolean(entry));
};

const mergeCookies = (previous, setCookies) => {
  const next = new Map();
  for (const token of String(previous ?? "").split(";")) {
    const trimmed = token.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [name, ...rest] = trimmed.split("=");
    next.set(name, `${name}=${rest.join("=")}`);
  }
  for (const token of setCookies) {
    const trimmed = token.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [name, ...rest] = trimmed.split("=");
    next.set(name, `${name}=${rest.join("=")}`);
  }
  return Array.from(next.values()).join("; ");
};

const requestJson = async ({
  path,
  method = "GET",
  body = undefined,
  cookie = "",
  extraHeaders = {},
}) => {
  const url = `${baseUrl}${path}`;
  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }

  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      }),
    timeoutMs
  );

  const setCookies = parseSetCookies(response.headers);
  const text = await response.text();
  let payload = null;
  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    setCookies,
    url,
  };
};

const buildWsUrl = (path) => {
  const url = new URL(path, `${baseUrl}/`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const openWorkbookLiveSocket = ({ sessionId, cookie }) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(
      buildWsUrl(`/api/workbook/sessions/${encodeURIComponent(sessionId)}/events/live`),
      {
        headers: cookie ? { Cookie: cookie } : undefined,
      }
    );
    const timerId = setTimeout(() => {
      ws.terminate();
      reject(new Error("ws_open_timeout"));
    }, wsTimeoutMs);
    ws.once("open", () => {
      clearTimeout(timerId);
      resolve(ws);
    });
    ws.once("error", (error) => {
      clearTimeout(timerId);
      reject(error);
    });
  });

const waitForWorkbookEvent = (ws, matcher, timeout) =>
  new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      cleanup();
      reject(new Error("ws_event_timeout"));
    }, timeout);

    const cleanup = () => {
      clearTimeout(timerId);
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
    };

    const onError = (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("ws_closed_before_expected_event"));
    };
    const onMessage = (raw) => {
      try {
        const parsed = JSON.parse(String(raw));
        if (!parsed || typeof parsed !== "object") return;
        if (!Array.isArray(parsed.events)) return;
        if (!matcher(parsed)) return;
        cleanup();
        resolve(parsed);
      } catch {
        // ignore malformed payloads
      }
    };

    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
  });

const createMinimalPdfDataUrl = () => {
  const stream = "BT /F1 18 Tf 72 100 Td (Mathwise PDF) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return `data:application/pdf;base64,${Buffer.from(pdf, "utf8").toString("base64")}`;
};

const run = async () => {
  const checks = [];
  let teacherCookie = "";
  let studentCookie = "";
  let teacherWs = null;
  let studentWs = null;
  let reconnectedStudentWs = null;

  try {
    const loginResponse = await requestJson({
      path: "/api/auth/password/login",
      method: "POST",
      body: {
        email: teacherEmail,
        password: teacherPassword,
      },
    });
    teacherCookie = mergeCookies("", loginResponse.setCookies);
    checks.push({
      name: "teacher_login",
      ok: loginResponse.status === 200 && teacherCookie.length > 0,
      detail: { status: loginResponse.status },
    });
    if (checks.at(-1).ok !== true) {
      throw new Error(`teacher_login_failed:${loginResponse.status}`);
    }

    const sessionResponse = await requestJson({
      path: "/api/auth/session",
      cookie: teacherCookie,
    });
    checks.push({
      name: "teacher_auth_session",
      ok: sessionResponse.status === 200 && sessionResponse.payload && sessionResponse.payload.id,
      detail: { status: sessionResponse.status },
    });

    const draftsResponse = await requestJson({
      path: "/api/workbook/drafts?scope=all",
      cookie: teacherCookie,
    });
    checks.push({
      name: "drafts_list",
      ok: draftsResponse.status === 200 && Array.isArray(draftsResponse.payload?.items),
      detail: { status: draftsResponse.status },
    });

    const createSessionResponse = await requestJson({
      path: "/api/workbook/sessions",
      method: "POST",
      cookie: teacherCookie,
      body: {
        kind: "CLASS",
        title: `Critical E2E ${nowIso()}`,
      },
    });
    const sessionId = createSessionResponse.payload?.session?.id;
    checks.push({
      name: "session_create",
      ok: createSessionResponse.status === 200 && typeof sessionId === "string" && sessionId.length > 0,
      detail: { status: createSessionResponse.status, sessionId },
    });
    if (checks.at(-1).ok !== true) {
      throw new Error(`session_create_failed:${createSessionResponse.status}`);
    }

    const openSessionResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/open`,
      method: "POST",
      cookie: teacherCookie,
      body: {},
    });
    checks.push({
      name: "session_open",
      ok: openSessionResponse.status === 200,
      detail: { status: openSessionResponse.status },
    });

    const inviteResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/invite`,
      method: "POST",
      cookie: teacherCookie,
      body: {},
    });
    const inviteToken = inviteResponse.payload?.token;
    checks.push({
      name: "invite_create",
      ok: inviteResponse.status === 200 && typeof inviteToken === "string" && inviteToken.length > 0,
      detail: { status: inviteResponse.status },
    });
    if (checks.at(-1).ok !== true) {
      throw new Error(`invite_create_failed:${inviteResponse.status}`);
    }

    const joinResponse = await requestJson({
      path: `/api/workbook/invites/${encodeURIComponent(inviteToken)}/join`,
      method: "POST",
      body: { guestName: studentName },
    });
    studentCookie = mergeCookies("", joinResponse.setCookies);
    checks.push({
      name: "invite_join",
      ok: joinResponse.status === 200 && studentCookie.length > 0,
      detail: { status: joinResponse.status },
    });
    if (checks.at(-1).ok !== true) {
      throw new Error(`invite_join_failed:${joinResponse.status}`);
    }

    teacherWs = await openWorkbookLiveSocket({ sessionId, cookie: teacherCookie });
    studentWs = await openWorkbookLiveSocket({ sessionId, cookie: studentCookie });
    checks.push({
      name: "live_ws_connect_teacher_student",
      ok: true,
      detail: { connected: 2 },
    });

    const imageObjectId = `critical-image-${Date.now()}`;
    const createImageEventResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
      method: "POST",
      cookie: teacherCookie,
      extraHeaders: {
        "X-Idempotency-Key": `critical-create-image-${Date.now()}`,
      },
      body: {
        events: [
          {
            clientEventId: `critical-create-image-${Date.now()}`,
            type: "board.object.create",
            payload: {
              object: {
                id: imageObjectId,
                type: "image",
                x: 120,
                y: 110,
                width: 160,
                height: 120,
                layer: "board",
                page: 1,
                zOrder: 2,
                src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6fE7kAAAAASUVORK5CYII=",
                createdAt: nowIso(),
                authorUserId: "critical-e2e",
              },
            },
          },
        ],
      },
    });
    checks.push({
      name: "draw_object_create",
      ok: createImageEventResponse.status === 200,
      detail: { status: createImageEventResponse.status },
    });

    const studentRealtimePromise = waitForWorkbookEvent(
      studentWs,
      (payload) =>
        payload.events.some(
          (event) =>
            event?.type === "board.object.reorder" &&
            event?.payload &&
            event.payload.objectId === imageObjectId
        ),
      wsTimeoutMs
    );

    const reorderResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
      method: "POST",
      cookie: teacherCookie,
      extraHeaders: {
        "X-Idempotency-Key": `critical-reorder-${Date.now()}`,
      },
      body: {
        events: [
          {
            clientEventId: `critical-reorder-${Date.now()}`,
            type: "board.object.reorder",
            payload: {
              objectId: imageObjectId,
              zOrder: 999,
            },
          },
        ],
      },
    });
    checks.push({
      name: "image_reorder",
      ok: reorderResponse.status === 200,
      detail: { status: reorderResponse.status },
    });

    let studentRealtime = null;
    let studentRealtimeError = null;
    try {
      studentRealtime = await studentRealtimePromise;
    } catch (error) {
      studentRealtimeError = error instanceof Error ? error.message : String(error);
    }
    checks.push({
      name: "student_realtime_received_reorder",
      ok: Boolean(studentRealtime?.latestSeq),
      detail: {
        latestSeq: studentRealtime?.latestSeq ?? null,
        error: studentRealtimeError,
      },
    });

    const eventsResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events?afterSeq=0`,
      cookie: teacherCookie,
    });
    const allEvents = Array.isArray(eventsResponse.payload?.events) ? eventsResponse.payload.events : [];
    const reorderFound = allEvents.some(
      (event) =>
        event?.type === "board.object.reorder" &&
        event?.payload &&
        event.payload.objectId === imageObjectId
    );
    checks.push({
      name: "events_poll_contains_reorder",
      ok: eventsResponse.status === 200 && reorderFound,
      detail: { status: eventsResponse.status, events: allEvents.length },
    });

    studentWs.close();
    await sleep(350);
    reconnectedStudentWs = await openWorkbookLiveSocket({ sessionId, cookie: studentCookie });

    const reconnectObjectId = `critical-reconnect-${Date.now()}`;
    const reconnectRealtimePromise = waitForWorkbookEvent(
      reconnectedStudentWs,
      (payload) =>
        payload.events.some(
          (event) =>
            event?.type === "board.object.create" &&
            event?.payload &&
            event.payload.object?.id === reconnectObjectId
        ),
      wsTimeoutMs
    );

    const reconnectCreateResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
      method: "POST",
      cookie: teacherCookie,
      extraHeaders: {
        "X-Idempotency-Key": `critical-reconnect-${Date.now()}`,
      },
      body: {
        events: [
          {
            clientEventId: `critical-reconnect-${Date.now()}`,
            type: "board.object.create",
            payload: {
              object: {
                id: reconnectObjectId,
                type: "shape",
                shapeType: "rect",
                x: 42,
                y: 64,
                width: 90,
                height: 48,
                layer: "board",
                page: 1,
                color: "#1f6feb",
                createdAt: nowIso(),
                authorUserId: "critical-e2e",
              },
            },
          },
        ],
      },
    });
    checks.push({
      name: "reconnect_append_event",
      ok: reconnectCreateResponse.status === 200,
      detail: { status: reconnectCreateResponse.status },
    });

    let reconnectRealtime = null;
    let reconnectRealtimeError = null;
    try {
      reconnectRealtime = await reconnectRealtimePromise;
    } catch (error) {
      reconnectRealtimeError = error instanceof Error ? error.message : String(error);
    }
    checks.push({
      name: "reconnect_realtime_ok",
      ok: Boolean(reconnectRealtime?.latestSeq),
      detail: {
        latestSeq: reconnectRealtime?.latestSeq ?? null,
        error: reconnectRealtimeError,
      },
    });

    const rollbackObjectId = `critical-rollback-${Date.now()}`;
    const createRollbackResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
      method: "POST",
      cookie: teacherCookie,
      extraHeaders: {
        "X-Idempotency-Key": `critical-create-rollback-${Date.now()}`,
      },
      body: {
        events: [
          {
            clientEventId: `critical-create-rollback-${Date.now()}`,
            type: "board.object.create",
            payload: {
              object: {
                id: rollbackObjectId,
                type: "shape",
                shapeType: "rect",
                x: 300,
                y: 300,
                width: 80,
                height: 40,
                page: 1,
                layer: "board",
                color: "#ef4444",
                createdAt: nowIso(),
                authorUserId: "critical-e2e",
              },
            },
          },
        ],
      },
    });
    const deleteRollbackResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events`,
      method: "POST",
      cookie: teacherCookie,
      extraHeaders: {
        "X-Idempotency-Key": `critical-delete-rollback-${Date.now()}`,
      },
      body: {
        events: [
          {
            clientEventId: `critical-delete-rollback-${Date.now()}`,
            type: "board.object.delete",
            payload: {
              objectId: rollbackObjectId,
            },
          },
        ],
      },
    });
    const rollbackEventsResponse = await requestJson({
      path: `/api/workbook/sessions/${encodeURIComponent(sessionId)}/events?afterSeq=0`,
      cookie: teacherCookie,
    });
    const rollbackEvents = Array.isArray(rollbackEventsResponse.payload?.events)
      ? rollbackEventsResponse.payload.events
      : [];
    const createIndexes = rollbackEvents
      .map((event, index) =>
        event?.type === "board.object.create" && event?.payload?.object?.id === rollbackObjectId
          ? index
          : -1
      )
      .filter((index) => index >= 0);
    const deleteIndexes = rollbackEvents
      .map((event, index) =>
        event?.type === "board.object.delete" && event?.payload?.objectId === rollbackObjectId
          ? index
          : -1
      )
      .filter((index) => index >= 0);
    const rollbackAnomaly =
      createIndexes.length === 0 ||
      deleteIndexes.length === 0 ||
      Math.max(...createIndexes) > Math.max(...deleteIndexes);
    checks.push({
      name: "rollback_anomaly_absent",
      ok:
        createRollbackResponse.status === 200 &&
        deleteRollbackResponse.status === 200 &&
        rollbackEventsResponse.status === 200 &&
        rollbackAnomaly === false,
      detail: {
        createStatus: createRollbackResponse.status,
        deleteStatus: deleteRollbackResponse.status,
        eventsStatus: rollbackEventsResponse.status,
        createIndexes,
        deleteIndexes,
      },
    });

    const pdfResponse = await requestJson({
      path: "/api/workbook/pdf/render",
      method: "POST",
      cookie: teacherCookie,
      body: {
        fileName: "critical-e2e.pdf",
        dataUrl: createMinimalPdfDataUrl(),
        dpi: 96,
        maxPages: 1,
      },
    });
    checks.push({
      name: "pdf_export_endpoint",
      ok:
        (pdfResponse.status === 200 || pdfResponse.status === 503) &&
        pdfResponse.payload &&
        Array.isArray(pdfResponse.payload.pages),
      detail: { status: pdfResponse.status, renderer: pdfResponse.payload?.renderer ?? null },
    });

    const logoutTeacherResponse = await requestJson({
      path: "/api/auth/logout",
      method: "POST",
      cookie: teacherCookie,
      body: {},
    });
    const authAfterLogout = await requestJson({
      path: "/api/auth/session",
      cookie: mergeCookies(teacherCookie, logoutTeacherResponse.setCookies),
    });
    checks.push({
      name: "logout_teacher",
      ok: logoutTeacherResponse.status === 200 && authAfterLogout.status === 200 && authAfterLogout.payload === null,
      detail: {
        logoutStatus: logoutTeacherResponse.status,
        sessionStatus: authAfterLogout.status,
      },
    });

    const ok = checks.every((entry) => entry.ok === true);
    const report = {
      ok,
      checkedAt: nowIso(),
      baseUrl,
      checks,
    };
    if (ok) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.error(JSON.stringify(report, null, 2));
    process.exit(2);
  } finally {
    teacherWs?.close();
    studentWs?.close();
    reconnectedStudentWs?.close();
  }
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        checkedAt: nowIso(),
        baseUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(2);
});
