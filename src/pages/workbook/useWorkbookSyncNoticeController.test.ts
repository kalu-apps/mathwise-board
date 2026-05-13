import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWorkbookSyncNotice } from "./useWorkbookSyncNoticeController";

test("workbook sync notice normalizes server downtime without VPN wording", () => {
  const notice = normalizeWorkbookSyncNotice(
    "Сервер синхронизации временно недоступен. Мы продолжаем восстановление автоматически."
  );

  assert.equal(notice.kind, "server");
  assert.match(notice.message, /Сервер синхронизации временно недоступен/);
  assert.doesNotMatch(notice.message, /vpn/i);
});

test("workbook sync notice coalesces recoverable sync warnings", () => {
  const notice = normalizeWorkbookSyncNotice(
    "Синхронизация доски заметно задерживается. Проверьте сеть, VPN или прокси."
  );

  assert.equal(notice.kind, "recoverable");
  assert.match(notice.message, /изменения отправятся автоматически/);
  assert.doesNotMatch(notice.message, /vpn|прокси/i);
});

test("workbook sync notice keeps access errors immediate and unchanged", () => {
  const message = "Сессия недоступна. Откройте доску по новой ссылке.";
  const notice = normalizeWorkbookSyncNotice(message);

  assert.equal(notice.kind, "access");
  assert.equal(notice.message, message);
});
