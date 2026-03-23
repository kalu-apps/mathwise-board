import {
  Suspense,
  lazy,
  type DragEventHandler,
  type MutableRefObject,
} from "react";
import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
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
  onBack: () => Promise<void> | void;
  isBackNavigationPending?: boolean;
  boardShellProps: React.ComponentProps<typeof WorkbookSessionBoardShell>;
  docsWindowOpen: boolean;
  docsWindowProps: WorkbookSessionDocsWindowProps;
  onWorkspaceDragOver?: DragEventHandler<HTMLDivElement>;
  onWorkspaceDrop?: DragEventHandler<HTMLDivElement>;
};

export function WorkbookSessionWorkspace({
  workspaceRef,
  graphCatalogCursorActive,
  contextbarProps,
  onBack,
  isBackNavigationPending = false,
  boardShellProps,
  docsWindowOpen,
  docsWindowProps,
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
        <Tooltip title={isBackNavigationPending ? "Возвращаемся к тетрадям..." : "Вернуться к тетрадям"}>
          <IconButton
            className="header__session-back workbook-session__session-back"
            disabled={isBackNavigationPending}
            onClick={() => {
              if (isBackNavigationPending) return;
              void onBack();
            }}
            size="small"
            aria-label={isBackNavigationPending ? "Возвращаемся к тетрадям" : "Вернуться к тетрадям"}
          >
            {isBackNavigationPending ? <CircularProgress size={16} thickness={5} /> : <ArrowBackRoundedIcon />}
          </IconButton>
        </Tooltip>
        <WorkbookSessionContextbar {...contextbarProps} />
      </div>
      <WorkbookSessionBoardShell {...boardShellProps} />

      {docsWindowOpen ? (
        <Suspense fallback={null}>
          <WorkbookSessionDocsWindow {...docsWindowProps} />
        </Suspense>
      ) : null}
    </div>
  );
}
