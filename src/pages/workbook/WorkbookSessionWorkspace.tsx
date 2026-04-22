import {
  Suspense,
  lazy,
  type DragEventHandler,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { WorkbookSessionContextbar } from "./WorkbookSessionContextbar";
import { WorkbookSessionBoardShell } from "./WorkbookSessionBoardShell";
import type { WorkbookSessionDocsWindowProps } from "./WorkbookSessionDocsWindow";

const WorkbookSessionDocsWindow = lazy(async () => ({
  default: (await import("./WorkbookSessionDocsWindow")).WorkbookSessionDocsWindow,
}));

type WorkbookSessionWorkspaceProps = {
  workspaceRef: MutableRefObject<HTMLDivElement | null>;
  graphCatalogCursorActive: boolean;
  contextbarProps: React.ComponentProps<typeof WorkbookSessionContextbar>;
  boardShellProps: React.ComponentProps<typeof WorkbookSessionBoardShell>;
  docsWindowOpen: boolean;
  docsWindowProps: WorkbookSessionDocsWindowProps;
  videoDock?: ReactNode;
  lessonRecordingWatermark?: ReactNode;
  onWorkspaceDragOver?: DragEventHandler<HTMLDivElement>;
  onWorkspaceDrop?: DragEventHandler<HTMLDivElement>;
};

export function WorkbookSessionWorkspace({
  workspaceRef,
  graphCatalogCursorActive,
  contextbarProps,
  boardShellProps,
  docsWindowOpen,
  docsWindowProps,
  videoDock,
  lessonRecordingWatermark,
  onWorkspaceDragOver,
  onWorkspaceDrop,
}: WorkbookSessionWorkspaceProps) {
  return (
    <div
      className={`workbook-session__workspace${
        graphCatalogCursorActive ? " is-graph-catalog-cursor" : ""
      }`}
      ref={workspaceRef}
      onDragOver={onWorkspaceDragOver}
      onDrop={onWorkspaceDrop}
    >
      <div className="workbook-session__workspace-head">
        <WorkbookSessionContextbar {...contextbarProps} />
      </div>
      <WorkbookSessionBoardShell {...boardShellProps} />
      {videoDock}
      {lessonRecordingWatermark}

      {docsWindowOpen ? (
        <Suspense fallback={null}>
          <WorkbookSessionDocsWindow {...docsWindowProps} />
        </Suspense>
      ) : null}
    </div>
  );
}
