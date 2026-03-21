import { useEffect, type MutableRefObject } from "react";
import { readStorage, writeStorage } from "@/shared/lib/localDb";
import {
  normalizeWorkbookPersonalBoardSettings,
  type ToolPaintSettings,
  type WorkbookPersonalBoardSettings,
} from "./WorkbookSessionPage.geometry";

interface UseWorkbookPersonalBoardSettingsPersistenceParams {
  personalBoardSettingsStorageKey: string;
  personalBoardSettingsReadyRef: MutableRefObject<boolean>;
  skipNextPersonalBoardSettingsPersistRef: MutableRefObject<boolean>;
  setPenToolSettings: (settings: ToolPaintSettings) => void;
  setHighlighterToolSettings: (settings: ToolPaintSettings) => void;
  setEraserRadius: (radius: number) => void;
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  clampedEraserRadius: number;
}

export function useWorkbookPersonalBoardSettingsPersistence({
  personalBoardSettingsStorageKey,
  personalBoardSettingsReadyRef,
  skipNextPersonalBoardSettingsPersistRef,
  setPenToolSettings,
  setHighlighterToolSettings,
  setEraserRadius,
  penToolSettings,
  highlighterToolSettings,
  clampedEraserRadius,
}: UseWorkbookPersonalBoardSettingsPersistenceParams) {
  useEffect(() => {
    personalBoardSettingsReadyRef.current = false;
    if (!personalBoardSettingsStorageKey) return;
    const stored = readStorage<Partial<WorkbookPersonalBoardSettings> | null>(
      personalBoardSettingsStorageKey,
      null
    );
    if (stored) {
      const normalized = normalizeWorkbookPersonalBoardSettings(stored);
      skipNextPersonalBoardSettingsPersistRef.current = true;
      setPenToolSettings(normalized.penToolSettings);
      setHighlighterToolSettings(normalized.highlighterToolSettings);
      setEraserRadius(normalized.eraserRadius);
    }
    personalBoardSettingsReadyRef.current = true;
  }, [
    personalBoardSettingsReadyRef,
    personalBoardSettingsStorageKey,
    setEraserRadius,
    setHighlighterToolSettings,
    setPenToolSettings,
    skipNextPersonalBoardSettingsPersistRef,
  ]);

  useEffect(() => {
    if (!personalBoardSettingsStorageKey || !personalBoardSettingsReadyRef.current) return;
    if (skipNextPersonalBoardSettingsPersistRef.current) {
      skipNextPersonalBoardSettingsPersistRef.current = false;
      return;
    }
    writeStorage(personalBoardSettingsStorageKey, {
      penToolSettings,
      highlighterToolSettings,
      eraserRadius: clampedEraserRadius,
    });
  }, [
    clampedEraserRadius,
    highlighterToolSettings,
    penToolSettings,
    personalBoardSettingsReadyRef,
    personalBoardSettingsStorageKey,
    skipNextPersonalBoardSettingsPersistRef,
  ]);
}
