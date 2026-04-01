type LessonRecordingWatermarkedVideoTrack = {
  track: MediaStreamTrack;
  cleanup: () => void;
};

const WATERMARK_TEXT = "Автор: Калугина Анна Викторовна";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const safeRadius = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const resolveFrameRate = (videoTrack: MediaStreamTrack) => {
  const settings =
    typeof videoTrack.getSettings === "function"
      ? videoTrack.getSettings()
      : ({} as MediaTrackSettings);
  const frameRate = Number(settings.frameRate ?? 30);
  if (!Number.isFinite(frameRate) || frameRate <= 0) return 30;
  return clamp(Math.round(frameRate), 15, 60);
};

const resolveCanvasSize = (videoTrack: MediaStreamTrack, video: HTMLVideoElement) => {
  const settings =
    typeof videoTrack.getSettings === "function"
      ? videoTrack.getSettings()
      : ({} as MediaTrackSettings);
  const width = Number(settings.width ?? video.videoWidth ?? 0);
  const height = Number(settings.height ?? video.videoHeight ?? 0);
  if (!Number.isFinite(width) || width <= 1 || !Number.isFinite(height) || height <= 1) {
    return { width: 1920, height: 1080 };
  }
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

const cleanupVideoElement = (video: HTMLVideoElement) => {
  try {
    video.pause();
  } catch {
    // ignore cleanup failures
  }
  video.removeAttribute("src");
  video.srcObject = null;
};

const waitForVideoReady = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    window.setTimeout(onReady, 600);
  });

const createFallbackTrack = (
  sourceTrack: MediaStreamTrack
): LessonRecordingWatermarkedVideoTrack => {
  const fallbackTrack = sourceTrack.clone();
  return {
    track: fallbackTrack,
    cleanup: () => {
      try {
        fallbackTrack.stop();
      } catch {
        // ignore cleanup failures
      }
    },
  };
};

const drawWatermarkLabel = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) => {
  const fontSize = clamp(Math.round(canvasHeight * 0.026), 18, 44);
  const horizontalPadding = clamp(Math.round(fontSize * 0.66), 12, 32);
  const verticalPadding = clamp(Math.round(fontSize * 0.42), 8, 20);
  const bottomOffset = clamp(Math.round(canvasHeight * 0.03), 16, 42);
  const rightOffset = clamp(Math.round(canvasWidth * 0.024), 16, 44);
  const borderRadius = clamp(Math.round(fontSize * 0.55), 8, 18);

  ctx.font = `700 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(WATERMARK_TEXT).width;
  const boxWidth = Math.ceil(textWidth + horizontalPadding * 2);
  const boxHeight = Math.ceil(fontSize + verticalPadding * 2);
  const boxX = Math.max(8, canvasWidth - boxWidth - rightOffset);
  const boxY = Math.max(8, canvasHeight - boxHeight - bottomOffset);

  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, borderRadius);
  ctx.fillStyle = "rgba(16, 20, 30, 0.56)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.07));
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillText(
    WATERMARK_TEXT,
    boxX + horizontalPadding,
    boxY + Math.round(boxHeight / 2)
  );
};

export const createLessonRecordingVideoTrackWithWatermark = async (
  sourceVideoTrack: MediaStreamTrack
): Promise<LessonRecordingWatermarkedVideoTrack> => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return createFallbackTrack(sourceVideoTrack);
  }

  const trackForCanvas = sourceVideoTrack.clone();
  const sourceStream = new MediaStream([trackForCanvas]);
  const video = document.createElement("video");
  video.muted = true;
  video.autoplay = false;
  video.playsInline = true;
  video.srcObject = sourceStream;

  try {
    await video.play();
  } catch {
    await waitForVideoReady(video);
    await video.play().catch(() => undefined);
  }

  const canvas = document.createElement("canvas");
  const { width, height } = resolveCanvasSize(trackForCanvas, video);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || typeof canvas.captureStream !== "function") {
    cleanupVideoElement(video);
    sourceStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore cleanup failures
      }
    });
    return createFallbackTrack(sourceVideoTrack);
  }

  const frameRate = resolveFrameRate(sourceVideoTrack);
  const canvasStream = canvas.captureStream(frameRate);
  const outputTrack = canvasStream.getVideoTracks()[0] ?? null;
  if (!outputTrack) {
    cleanupVideoElement(video);
    sourceStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore cleanup failures
      }
    });
    canvasStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore cleanup failures
      }
    });
    return createFallbackTrack(sourceVideoTrack);
  }

  let rafId = 0;
  let active = true;
  const renderFrame = () => {
    if (!active) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawWatermarkLabel(ctx, canvas.width, canvas.height);
    }
    rafId = window.requestAnimationFrame(renderFrame);
  };
  renderFrame();

  return {
    track: outputTrack,
    cleanup: () => {
      active = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      canvasStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore cleanup failures
        }
      });
      sourceStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore cleanup failures
        }
      });
      cleanupVideoElement(video);
    },
  };
};
