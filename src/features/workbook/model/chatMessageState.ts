import type { WorkbookChatMessage } from "./types";

export const upsertWorkbookChatMessage = (
  messages: WorkbookChatMessage[],
  message: WorkbookChatMessage
): WorkbookChatMessage[] => {
  const existingIndex = messages.findIndex((item) => item.id === message.id);
  if (existingIndex < 0) {
    return [...messages, message];
  }
  const current = messages[existingIndex];
  if (
    current.authorUserId === message.authorUserId &&
    current.authorName === message.authorName &&
    current.text === message.text &&
    current.createdAt === message.createdAt
  ) {
    return messages;
  }
  const next = [...messages];
  next[existingIndex] = message;
  return next;
};
