import { Suspense, lazy, type MutableRefObject } from "react";
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
};

export function WorkbookSessionWorkspace({
  workspaceRef,
  graphCatalogCursorActive,
  contextbarProps,
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
      <WorkbookSessionContextbar {...contextbarProps} />
      <WorkbookSessionBoardShell {...boardShellProps} />

      {docsWindowOpen ? (
        <Suspense fallback={null}>
          <WorkbookSessionDocsWindow {...docsWindowProps} />
        </Suspense>
      ) : null}
    </div>
  );
}
