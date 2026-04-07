import type { WorkbookBoardObject, WorkbookBoardSettings } from "@/features/workbook/model/types";
import { cloneSerializable, normalizeMetaRecord } from "./WorkbookSessionPage.core";

const toRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const buildObjectPatchSemanticPayload = (
  before: WorkbookBoardObject,
  after: WorkbookBoardObject,
  patch: Partial<WorkbookBoardObject>
) => {
  const patchRecord = toRecord(patch);
  if (!patchRecord) return null;
  const touchedKeys = Object.keys(patchRecord);
  if (touchedKeys.length === 0) return null;

  const beforePatch: Partial<WorkbookBoardObject> = {};
  const afterPatch: Partial<WorkbookBoardObject> = {};
  const beforePatchRecord = beforePatch as Record<string, unknown>;
  const afterPatchRecord = afterPatch as Record<string, unknown>;
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;

  touchedKeys.forEach((key) => {
    if (key !== "meta") {
      beforePatchRecord[key] = cloneSerializable(beforeRecord[key]);
      afterPatchRecord[key] = cloneSerializable(afterRecord[key]);
      return;
    }
    const patchMeta = toRecord(patchRecord.meta);
    if (!patchMeta) {
      beforePatchRecord.meta = cloneSerializable(before.meta);
      afterPatchRecord.meta = cloneSerializable(after.meta);
      return;
    }
    const beforeMeta = normalizeMetaRecord(before.meta);
    const afterMeta = normalizeMetaRecord(after.meta);
    const touchedMetaKeys = Object.keys(patchMeta);
    const beforeMetaPatch: Record<string, unknown> = {};
    const afterMetaPatch: Record<string, unknown> = {};
    touchedMetaKeys.forEach((metaKey) => {
      beforeMetaPatch[metaKey] = cloneSerializable(beforeMeta[metaKey]);
      afterMetaPatch[metaKey] = cloneSerializable(afterMeta[metaKey]);
    });
    beforePatchRecord.meta = beforeMetaPatch;
    afterPatchRecord.meta = afterMetaPatch;
  });

  return {
    beforePatch,
    afterPatch,
  };
};

export const buildBoardSettingsPatchSemanticPayload = (
  before: WorkbookBoardSettings,
  after: WorkbookBoardSettings,
  patch: Partial<WorkbookBoardSettings>
) => {
  const patchRecord = toRecord(patch);
  if (!patchRecord) return null;
  const touchedKeys = Object.keys(patchRecord);
  if (touchedKeys.length === 0) return null;

  const beforePatch: Partial<WorkbookBoardSettings> = {};
  const afterPatch: Partial<WorkbookBoardSettings> = {};
  const beforePatchRecord = beforePatch as Record<string, unknown>;
  const afterPatchRecord = afterPatch as Record<string, unknown>;
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;

  touchedKeys.forEach((key) => {
    beforePatchRecord[key] = cloneSerializable(beforeRecord[key]);
    afterPatchRecord[key] = cloneSerializable(afterRecord[key]);
  });

  return {
    beforePatch,
    afterPatch,
  };
};
