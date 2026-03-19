import { useEffect, type MutableRefObject } from "react";
import { readStorage, writeStorage } from "@/shared/lib/localDb";
import { normalizeSmartInkOptions, type SmartInkOptions } from "./workbookBoardSettingsModel";
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
  setSmartInkOptions: (options: SmartInkOptions) => void;
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  clampedEraserRadius: number;
  smartInkOptions: SmartInkOptions;
}

export function useWorkbookPersonalBoardSettingsPersistence({
  personalBoardSettingsStorageKey,
  personalBoardSettingsReadyRef,
  skipNextPersonalBoardSettingsPersistRef,
  setPenToolSettings,
  setHighlighterToolSettings,
  setEraserRadius,
  setSmartInkOptions,
  penToolSettings,
  highlighterToolSettings,
  clampedEraserRadius,
  smartInkOptions,
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
      setSmartInkOptions(normalized.smartInkOptions);
    }
    personalBoardSettingsReadyRef.current = true;
  }, [
    personalBoardSettingsReadyRef,
    personalBoardSettingsStorageKey,
    setEraserRadius,
    setHighlighterToolSettings,
    setPenToolSettings,
    setSmartInkOptions,
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
      smartInkOptions: normalizeSmartInkOptions(smartInkOptions),
    });
  }, [
    clampedEraserRadius,
    highlighterToolSettings,
    penToolSettings,
    personalBoardSettingsReadyRef,
    personalBoardSettingsStorageKey,
    skipNextPersonalBoardSettingsPersistRef,
    smartInkOptions,
  ]);
}
