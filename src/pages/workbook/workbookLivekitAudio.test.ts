import assert from "node:assert/strict";
import test from "node:test";
import {
  hasWorkbookLivekitAudioUserActivation,
  startWorkbookLivekitAudioPlayback,
  type WorkbookRemoteAudioBinding,
} from "./workbookLivekitAudio";

const buildAudioBinding = (onPlay: () => Promise<void>): WorkbookRemoteAudioBinding =>
  ({
    element: { play: onPlay },
    track: {},
  }) as WorkbookRemoteAudioBinding;

test("audio activation is false outside the browser document", () => {
  assert.equal(hasWorkbookLivekitAudioUserActivation(), false);
});

test("audio playback start attempts LiveKit room audio and all attached elements", async () => {
  const calls: string[] = [];
  await startWorkbookLivekitAudioPlayback({
    bindings: [
      buildAudioBinding(async () => {
        calls.push("first-element");
      }),
      buildAudioBinding(async () => {
        calls.push("second-element");
        throw new Error("blocked");
      }),
    ],
    room: {
      startAudio: async () => {
        calls.push("room");
        throw new Error("blocked");
      },
    } as never,
  });

  assert.deepEqual(calls.sort(), ["first-element", "room", "second-element"]);
});
