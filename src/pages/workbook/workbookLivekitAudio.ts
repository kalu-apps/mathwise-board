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

export const startWorkbookLivekitAudioPlayback = async ({
  bindings,
  room,
}: {
  bindings: Iterable<WorkbookRemoteAudioBinding>;
  room: LivekitRoom | null;
}) => {
  const tasks = Array.from(bindings, (binding) =>
    binding.element.play().catch(() => undefined)
  );
  if (room) {
    tasks.unshift(room.startAudio().catch(() => undefined));
  }
  await Promise.all(tasks);
};
