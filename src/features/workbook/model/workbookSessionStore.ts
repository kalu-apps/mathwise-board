import { create } from "zustand";
import { createWorkbookSessionStoreActions } from "./workbookSessionStoreActions";
import { buildInitialWorkbookSessionCoreState } from "./workbookSessionStoreInitialState";
import type {
  WorkbookSessionStoreState,
  StateUpdater,
  WorkbookToolPaintSettings,
} from "./workbookSessionStoreTypes";

export type { StateUpdater, WorkbookToolPaintSettings };

export const useWorkbookSessionStore = create<WorkbookSessionStoreState>()((set) => ({
  ...buildInitialWorkbookSessionCoreState(),
  actions: createWorkbookSessionStoreActions(set),
}));
