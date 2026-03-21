import { Suspense, lazy, type MutableRefObject } from "react";
import { IconButton, Tooltip } from "@mui/material";
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
  boardShellProps: React.ComponentProps<typeof WorkbookSessionBoardShell>;
  docsWindowOpen: boolean;
  docsWindowProps: WorkbookSessionDocsWindowProps;
};

export function WorkbookSessionWorkspace({
  workspaceRef,
  graphCatalogCursorActive,
  contextbarProps,
  onBack,
  boardShellProps,
  docsWindowOpen,
  docsWindowProps,
}: WorkbookSessionWorkspaceProps) {
  return (
    <div
      className={`workbook-session__workspace${
        graphCatalogCursorActive ? " is-graph-catalog-cursor" : ""
      }`}
      ref={workspaceRef}
    >
      <div className="workbook-session__workspace-head">
        <Tooltip title="Вернуться к тетрадям">
          <IconButton
            className="header__session-back workbook-session__session-back"
            onClick={() => {
              void onBack();
            }}
            size="small"
            aria-label="Вернуться к тетрадям"
          >
            <ArrowBackRoundedIcon />
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
