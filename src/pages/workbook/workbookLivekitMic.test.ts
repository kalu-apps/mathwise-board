import assert from "node:assert/strict";
import test from "node:test";
import { summarizeWorkbookLivekitMicrophoneFailure } from "./workbookLivekitMic";

test("microphone permission errors are not retried", () => {
  assert.equal(
    summarizeWorkbookLivekitMicrophoneFailure(new DOMException("denied", "NotAllowedError"))
      .retryable,
    false
  );
  assert.equal(
    summarizeWorkbookLivekitMicrophoneFailure(new DOMException("missing", "NotFoundError"))
      .retryable,
    false
  );
});

test("transient LiveKit microphone transport failures are retried", () => {
  assert.equal(
    summarizeWorkbookLivekitMicrophoneFailure(new Error("signal connection timed out")).retryable,
    true
  );
  assert.equal(
    summarizeWorkbookLivekitMicrophoneFailure(new Error("websocket disconnected")).retryable,
    true
  );
});
