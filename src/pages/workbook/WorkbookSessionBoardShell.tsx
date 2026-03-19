import type { ReactNode } from "react";
import { Tooltip } from "@mui/material";
import PentagonRoundedIcon from "@mui/icons-material/PentagonRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { WorkbookCanvas } from "@/features/workbook/ui/WorkbookCanvas";

type WorkbookSessionBoardShellProps = {
  canvasProps: React.ComponentProps<typeof WorkbookCanvas>;
  isSessionTabPassive: boolean;
  activeSessionTabId: string | null;
  presenceTabId: string;
  beforeCatalogToolButtons: ReactNode[];
  afterCatalogToolButtons: ReactNode[];
  canDraw: boolean;
  onOpenShapesDialog: () => void;
  onOpenStereoDialog: () => void;
};

export function WorkbookSessionBoardShell({
  canvasProps,
  isSessionTabPassive,
  activeSessionTabId,
  presenceTabId,
  beforeCatalogToolButtons,
  afterCatalogToolButtons,
  canDraw,
  onOpenShapesDialog,
  onOpenStereoDialog,
}: WorkbookSessionBoardShellProps) {
  return (
    <div className="workbook-session__board-shell">
      <WorkbookCanvas {...canvasProps} />
      {isSessionTabPassive ? (
        <div className="workbook-session__tab-passive-overlay" role="status" aria-live="polite">
          <div className="workbook-session__tab-passive-overlay-card">
            <h4>Сессия уже открыта в другой вкладке</h4>
            <p>Эта вкладка работает в режиме просмотра, чтобы избежать расхождения данных.</p>
            {activeSessionTabId && activeSessionTabId !== presenceTabId ? (
              <p className="workbook-session__tab-passive-overlay-meta">
                Вернитесь в активную вкладку или закройте ее, чтобы продолжить работу здесь.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <aside className="workbook-session__tools">
        {beforeCatalogToolButtons}
        <Tooltip title="Каталог 2D-фигур" placement="left" arrow>
          <span>
            <button
              type="button"
              className="workbook-session__tool-btn workbook-session__tool-special"
              disabled={!canDraw}
              aria-label="Каталог 2D-фигур"
              onClick={onOpenShapesDialog}
            >
              <PentagonRoundedIcon />
            </button>
          </span>
        </Tooltip>
        <Tooltip title="Стереометрия (3D-библиотека)" placement="left" arrow>
          <span>
            <button
              type="button"
              className="workbook-session__tool-btn workbook-session__tool-special"
              disabled={!canDraw}
              aria-label="Стереометрия"
              onClick={onOpenStereoDialog}
            >
              <ViewInArRoundedIcon />
            </button>
          </span>
        </Tooltip>
        {afterCatalogToolButtons}
      </aside>
    </div>
  );
}
