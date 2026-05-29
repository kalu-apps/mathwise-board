import type { RemoteAudioTrack, Room as LivekitRoom } from "livekit-client";

export type WorkbookRemoteAudioBinding = {
  track: RemoteAudioTrack;
  element: HTMLAudioElement;
};

export const configureWorkbookRemoteAudioElement = (element: HTMLAudioElement) => {
  element.autoplay = false;
  element.setAttribute("playsinline", "true");
  element.muted = false;
  element.volume = 1;
  element.style.display = "none";
};

export const detachWorkbookRemoteAudioBinding = (binding: WorkbookRemoteAudioBinding) => {
  try {
    binding.track.detach(binding.element);
  } catch {
    // ignore detach races during reconnect
  }
  try {
    binding.element.pause();
  } catch {
    // ignore pause races during reconnect
  }
  binding.element.srcObject = null;
  binding.element.remove();
};

export const hasWorkbookLivekitAudioUserActivation = () => {
  if (typeof document === "undefined") return false;
  const activation = (
    document as Document & {
      userActivation?: { hasBeenActive?: boolean; isActive?: boolean };
    }
  ).userActivation;
  return Boolean(activation?.isActive || activation?.hasBeenActive);
};

export type WorkbookLivekitAudioPlaybackResult = {
  audioElementCount: number;
  blockedAudioElementCount: number;
  roomAudioBlocked: boolean;
};

const isAudioPlaybackBlocked = (reason: unknown) => {
  if (reason instanceof DOMException) {
    return reason.name === "NotAllowedError" || reason.name === "AbortError";
  }
  if (!(reason instanceof Error)) return false;
  const normalizedMessage = reason.message.toLowerCase();
  return (
    normalizedMessage.includes("notallowed") ||
    normalizedMessage.includes("not allowed") ||
    normalizedMessage.includes("user gesture") ||
    normalizedMessage.includes("interrupted")
  );
};

export const startWorkbookLivekitAudioPlayback = async ({
  bindings,
  room,
}: {
  bindings: Iterable<WorkbookRemoteAudioBinding>;
  room: LivekitRoom | null;
}): Promise<WorkbookLivekitAudioPlaybackResult> => {
  const bindingList = Array.from(bindings);
  let blockedAudioElementCount = 0;
  let roomAudioBlocked = false;
  const tasks = bindingList.map((binding) =>
    binding.element.play().catch((reason) => {
      if (isAudioPlaybackBlocked(reason)) {
        blockedAudioElementCount += 1;
      }
    })
  );
  if (room) {
    tasks.unshift(
      room.startAudio().catch((reason) => {
        if (isAudioPlaybackBlocked(reason)) {
          roomAudioBlocked = true;
        }
      })
    );
  }
  await Promise.all(tasks);
  return {
    audioElementCount: bindingList.length,
    blockedAudioElementCount,
    roomAudioBlocked,
  };
};
