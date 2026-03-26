import type { ReactNode } from "react";
import { Tooltip } from "@mui/material";
import PentagonRoundedIcon from "@mui/icons-material/PentagonRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { WorkbookCanvas } from "@/features/workbook/ui/WorkbookCanvas";
import { InlineMobiusLoader } from "@/shared/ui/loading";

type WorkbookSessionBoardShellProps = {
  canvasProps: React.ComponentProps<typeof WorkbookCanvas>;
  pageTransitionOverlay?: {
    active: boolean;
    label?: string;
  };
  isSessionTabPassive: boolean;
  isSessionAccessBlocked?: boolean;
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
  pageTransitionOverlay,
  isSessionTabPassive,
  isSessionAccessBlocked = false,
  activeSessionTabId,
  presenceTabId,
  beforeCatalogToolButtons,
  afterCatalogToolButtons,
  canDraw,
  onOpenShapesDialog,
  onOpenStereoDialog,
}: WorkbookSessionBoardShellProps) {
  const shouldRenderWorkspaceBlockOverlay = isSessionTabPassive || isSessionAccessBlocked;
  const overlayTitle = isSessionAccessBlocked
    ? "Сессия заблокирована в другом браузере"
    : "Сессия уже открыта в другой вкладке";
  const overlayMessage = isSessionAccessBlocked
    ? "Рабочая область недоступна в этом окне. Продолжайте работу только в последнем открытом браузере/вкладке."
    : "Эта вкладка работает в режиме просмотра, чтобы избежать расхождения данных.";

  return (
    <div className="workbook-session__board-shell">
      <WorkbookCanvas {...canvasProps} />
      {pageTransitionOverlay?.active ? (
        <div className="workbook-session__page-transition-overlay" role="status" aria-live="polite">
          <div className="workbook-session__page-transition-overlay-card">
            <InlineMobiusLoader
              size="panel"
              label={pageTransitionOverlay.label || "Загружаем страницу..."}
            />
          </div>
        </div>
      ) : null}
      {shouldRenderWorkspaceBlockOverlay ? (
        <div className="workbook-session__tab-passive-overlay" role="status" aria-live="polite">
          <div className="workbook-session__tab-passive-overlay-card">
            <h4>{overlayTitle}</h4>
            <p>{overlayMessage}</p>
            {!isSessionAccessBlocked && activeSessionTabId && activeSessionTabId !== presenceTabId ? (
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
