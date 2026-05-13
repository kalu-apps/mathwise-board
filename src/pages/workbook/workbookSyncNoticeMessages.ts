import { ApiError } from "@/shared/api/client";

const isServerUnavailableError = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === "server_unavailable" ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504);

export const getWorkbookRecoverableSyncWarningMessage = (error: unknown) =>
  isServerUnavailableError(error)
    ? "Сервер синхронизации временно недоступен. Мы продолжаем восстановление автоматически."
    : "Синхронизация доски заметно задерживается. Проверьте интернет-соединение. Мы продолжаем восстановление автоматически.";
