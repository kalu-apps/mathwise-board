const nextAnimationFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        resolve();
      });
      return;
    }
    setTimeout(resolve, 0);
  });

export const processWorkbookItemsInChunks = async <T>(params: {
  items: T[];
  chunkSize: number;
  processChunk: (chunk: T[], offset: number) => void;
  isCancelled?: () => boolean;
}) => {
  const safeChunkSize = Math.max(1, Math.floor(params.chunkSize));
  for (let offset = 0; offset < params.items.length; offset += safeChunkSize) {
    if (params.isCancelled?.()) {
      return false;
    }
    const chunk = params.items.slice(offset, offset + safeChunkSize);
    params.processChunk(chunk, offset);
    if (offset + safeChunkSize < params.items.length) {
      await nextAnimationFrame();
    }
  }
  return true;
};
