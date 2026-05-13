import { useCallback, useRef } from "react";

type StateUpdater<T> = T | ((current: T) => T);
type SetSyncNotice = (updater: StateUpdater<string | null>) => void;

type WorkbookSyncNoticeKind = "access" | "server" | "recoverable" | "other";

type WorkbookSyncNotice = {
  kind: WorkbookSyncNoticeKind;
  message: string;
};

const RECOVERABLE_NOTICE_COOLDOWN_MS = 120_000;
const SERVER_NOTICE_COOLDOWN_MS = 90_000;

const RECOVERABLE_SYNC_NOTICE_MESSAGE =
  "Синхронизация временно задерживается. Не закрывайте вкладку: изменения отправятся автоматически.";
const SERVER_SYNC_NOTICE_MESSAGE =
  "Сервер синхронизации временно недоступен. Не закрывайте вкладку: изменения отправятся автоматически после восстановления.";

const normalizeText = (value: string) => value.trim().toLowerCase();

export const normalizeWorkbookSyncNotice = (message: string): WorkbookSyncNotice => {
  const trimmed = message.trim();
  if (!trimmed) return { kind: "other", message: "" };
  const normalized = normalizeText(trimmed);
  if (
    normalized.includes("сессия недоступна") ||
    normalized.includes("сессия авторизации") ||
    normalized.includes("нет доступа") ||
    normalized.includes("сессия не найдена")
  ) {
    return { kind: "access", message: trimmed };
  }
  if (
    normalized.includes("сервер синхронизации временно недоступен") ||
    normalized.includes("сервер временно недоступен")
  ) {
    return { kind: "server", message: SERVER_SYNC_NOTICE_MESSAGE };
  }
  if (
    normalized.includes("синхронизация") ||
    normalized.includes("автосохранение") ||
    normalized.includes("резервное сохранение")
  ) {
    return { kind: "recoverable", message: RECOVERABLE_SYNC_NOTICE_MESSAGE };
  }
  return { kind: "other", message: trimmed };
};

const noticeCooldownMs = (kind: WorkbookSyncNoticeKind) => {
  if (kind === "server") return SERVER_NOTICE_COOLDOWN_MS;
  if (kind === "recoverable") return RECOVERABLE_NOTICE_COOLDOWN_MS;
  return 0;
};

export const useWorkbookSyncNoticeController = ({
  setSaveSyncWarning: setSaveSyncWarningRaw,
  setRealtimeSyncWarning: setRealtimeSyncWarningRaw,
}: {
  setSaveSyncWarning: SetSyncNotice;
  setRealtimeSyncWarning: SetSyncNotice;
}) => {
  const lastShownAtByKindRef = useRef<Partial<Record<WorkbookSyncNoticeKind, number>>>({});

  const resolveNextNotice = useCallback(
    (current: string | null, updater: StateUpdater<string | null>) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next === null) return null;
      const notice = normalizeWorkbookSyncNotice(next);
      if (!notice.message) return null;
      const cooldownMs = noticeCooldownMs(notice.kind);
      if (cooldownMs <= 0 || current === notice.message) {
        lastShownAtByKindRef.current[notice.kind] = Date.now();
        return notice.message;
      }
      const now = Date.now();
      const lastShownAt = lastShownAtByKindRef.current[notice.kind] ?? 0;
      if (now - lastShownAt < cooldownMs) {
        return current;
      }
      lastShownAtByKindRef.current[notice.kind] = now;
      return notice.message;
    },
    []
  );

  const clearPeerRecoverableNotice = useCallback((peerSetter: SetSyncNotice) => {
    peerSetter((current) => {
      if (!current) return current;
      const currentNotice = normalizeWorkbookSyncNotice(current);
      return currentNotice.kind === "server" || currentNotice.kind === "recoverable"
        ? null
        : current;
    });
  }, []);

  const setSaveSyncWarning = useCallback<SetSyncNotice>(
    (updater) => {
      if (updater === null) {
        clearPeerRecoverableNotice(setRealtimeSyncWarningRaw);
      }
      setSaveSyncWarningRaw((current) => resolveNextNotice(current, updater));
    },
    [clearPeerRecoverableNotice, resolveNextNotice, setRealtimeSyncWarningRaw, setSaveSyncWarningRaw]
  );

  const setRealtimeSyncWarning = useCallback<SetSyncNotice>(
    (updater) => {
      if (updater === null) {
        clearPeerRecoverableNotice(setSaveSyncWarningRaw);
      }
      setRealtimeSyncWarningRaw((current) => resolveNextNotice(current, updater));
    },
    [clearPeerRecoverableNotice, resolveNextNotice, setRealtimeSyncWarningRaw, setSaveSyncWarningRaw]
  );

  return {
    setSaveSyncWarning,
    setRealtimeSyncWarning,
  };
};
