import {
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import NavigateBeforeRoundedIcon from "@mui/icons-material/NavigateBeforeRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import type { WorkbookUtilityTab } from "@/features/workbook/model/workbookSessionUiTypes";
import type { WorkbookBoardPageOption } from "./WorkbookSessionBoardSettingsPanel";

interface WorkbookSessionContextbarProps {
  overlayContainer?: Element | null;
  menuAnchor: HTMLElement | null;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
  exportBoardAsPdf: () => Promise<void> | void;
  exportingSections: boolean;
  onMenuClearBoard: () => Promise<void> | void;
  canClear: boolean;
  isEnded: boolean;
  canAccessBoardSettingsPanel: boolean;
  isUtilityPanelOpen: boolean;
  utilityTab: WorkbookUtilityTab;
  openUtilityPanel: (tab: "settings" | "graph" | "transform") => void;
  boardPageOptions: WorkbookBoardPageOption[];
  currentBoardPage: number;
  totalBoardPages: number;
  canManageBoardPages: boolean;
  isBoardPageMutationPending: boolean;
  onSelectBoardPage: (page: number) => void;
  onAddBoardPage: () => void;
  onDeleteBoardPage: (page: number) => void;
  canUseUndo: boolean;
  undoDepth: number;
  redoDepth: number;
  onUndo: () => Promise<void> | void;
  onRedo: () => Promise<void> | void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  viewportZoom: number;
  canInsertImage: boolean;
  onRequestDocsUpload: () => void;
  hotkeysTooltipContent: ReactNode;
  isFullscreen: boolean;
  onToggleFullscreen: () => Promise<void> | void;
  showCollaborationPanels: boolean;
  isParticipantsCollapsed: boolean;
  onToggleParticipantsCollapsed: () => void;
  showInviteLinkButton: boolean;
  copyingInviteLink: boolean;
  onCopyInviteLink: () => Promise<void> | void;
  contextbarRef: MutableRefObject<HTMLDivElement | null>;
  isDockedContextbarViewport: boolean;
  isCompactViewport: boolean;
}

export function WorkbookSessionContextbar({
  overlayContainer,
  menuAnchor,
  setMenuAnchor,
  exportBoardAsPdf,
  exportingSections,
  onMenuClearBoard,
  canClear,
  isEnded,
  canAccessBoardSettingsPanel,
  isUtilityPanelOpen,
  utilityTab,
  openUtilityPanel,
  boardPageOptions,
  currentBoardPage,
  totalBoardPages,
  canManageBoardPages,
  isBoardPageMutationPending,
  onSelectBoardPage,
  onAddBoardPage,
  onDeleteBoardPage,
  canUseUndo,
  undoDepth,
  redoDepth,
  onUndo,
  onRedo,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  viewportZoom,
  canInsertImage,
  onRequestDocsUpload,
  hotkeysTooltipContent,
  isFullscreen,
  onToggleFullscreen,
  showCollaborationPanels,
  isParticipantsCollapsed,
  onToggleParticipantsCollapsed,
  showInviteLinkButton,
  copyingInviteLink,
  onCopyInviteLink,
  contextbarRef,
  isDockedContextbarViewport,
  isCompactViewport,
}: WorkbookSessionContextbarProps) {
  const safeCurrentBoardPage = Math.max(1, Math.round(currentBoardPage || 1));
  const safeTotalBoardPages = Math.max(
    safeCurrentBoardPage,
    Math.round(totalBoardPages || 1)
  );
  const pagesWithContent = boardPageOptions.reduce(
    (count, option) => count + (option.hasContent ? 1 : 0),
    0
  );
  const canMutatePages = canManageBoardPages && !isBoardPageMutationPending;
  const canGoPrev = canMutatePages && safeCurrentBoardPage > 1;
  const canGoNext = canMutatePages && safeCurrentBoardPage < safeTotalBoardPages;
  const canDeleteCurrentPage = canMutatePages && safeTotalBoardPages > 1;

  return (
    <div
      ref={contextbarRef}
      className={`workbook-session__contextbar-dock${
        isDockedContextbarViewport ? " is-docked" : ""
      }${
        isCompactViewport ? " is-compact" : ""
      } is-static`}
    >
      <div className="workbook-session__contextbar">
        <Menu
          container={overlayContainer}
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              void exportBoardAsPdf();
              setMenuAnchor(null);
            }}
            disabled={exportingSections}
          >
            Экспорт PDF
          </MenuItem>
          <MenuItem
            onClick={() => {
              void onMenuClearBoard();
            }}
            disabled={!canClear || isEnded}
          >
            Очистить доску
          </MenuItem>
        </Menu>
        <Tooltip title="Меню доски" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MenuRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip
          title={
            canAccessBoardSettingsPanel
              ? "Настройки доски"
              : "Преподаватель еще не открыл доступ к настройкам доски"
          }
          placement="bottom"
          arrow
        >
          <span>
            <IconButton
              size="small"
              className={`workbook-session__toolbar-icon ${
                isUtilityPanelOpen && utilityTab === "settings" ? "is-active" : ""
              }`}
              disabled={!canAccessBoardSettingsPanel}
              onClick={() => openUtilityPanel("settings")}
            >
              <TuneRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Предыдущая страница" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              disabled={!canGoPrev}
              onClick={() => onSelectBoardPage(safeCurrentBoardPage - 1)}
            >
              <NavigateBeforeRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip
          title={`Текущая страница: ${safeCurrentBoardPage}. Всего страниц: ${safeTotalBoardPages}. Страниц с контентом: ${pagesWithContent}.`}
          placement="bottom"
          arrow
        >
          <span className="workbook-session__page-badge">Стр. {safeCurrentBoardPage}</span>
        </Tooltip>
        <Tooltip title="Следующая страница" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              disabled={!canGoNext}
              onClick={() => onSelectBoardPage(safeCurrentBoardPage + 1)}
            >
              <NavigateNextRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Добавить страницу" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              disabled={!canMutatePages}
              onClick={onAddBoardPage}
            >
              <AddRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Удалить текущую страницу" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              disabled={!canDeleteCurrentPage}
              onClick={() => onDeleteBoardPage(safeCurrentBoardPage)}
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Отменить" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={() => void onUndo()}
              disabled={!canUseUndo || undoDepth === 0}
            >
              <UndoRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Повторить" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={() => void onRedo()}
              disabled={!canUseUndo || redoDepth === 0}
            >
              <RedoRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Уменьшить масштаб" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={onZoomOut}
            >
              <ZoomOutRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Сбросить масштаб до 100%" placement="bottom" arrow>
          <button
            type="button"
            className="workbook-session__zoom-badge"
            onClick={onResetZoom}
          >
            {Math.round(viewportZoom * 100)}%
          </button>
        </Tooltip>
        <Tooltip title="Увеличить масштаб" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={onZoomIn}
            >
              <ZoomInRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Сбросить масштаб" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={onResetZoom}
            >
              <CenterFocusStrongRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Загрузить документ" placement="bottom" arrow>
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={onRequestDocsUpload}
              disabled={!canInsertImage}
            >
              <UploadFileRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={hotkeysTooltipContent} placement="bottom-start" arrow>
          <span>
            <IconButton size="small" className="workbook-session__toolbar-icon">
              <HelpOutlineRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip
          title={isFullscreen ? "Выйти из полного экрана" : "Полный экран"}
          placement="bottom"
          arrow
        >
          <span>
            <IconButton
              size="small"
              className="workbook-session__toolbar-icon"
              onClick={() => void onToggleFullscreen()}
            >
              {isFullscreen ? <FullscreenExitRoundedIcon /> : <FullscreenRoundedIcon />}
            </IconButton>
          </span>
        </Tooltip>
        {showInviteLinkButton ? (
          <Tooltip title="Скопировать ссылку приглашения" placement="bottom" arrow>
            <span className="workbook-session__invite-link-wrap">
              <Button
                size="small"
                variant="outlined"
                className="workbook-session__invite-link-button"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={() => void onCopyInviteLink()}
                disabled={copyingInviteLink}
              >
                Ссылка-приглашение
              </Button>
            </span>
          </Tooltip>
        ) : null}
        {showCollaborationPanels ? (
          <Tooltip
            title={
              isParticipantsCollapsed
                ? "Открыть блок участников"
                : "Свернуть блок участников"
            }
            placement="bottom"
            arrow
          >
            <span
              className={showInviteLinkButton ? "workbook-session__participants-toggle-wrap" : ""}
            >
              <IconButton
                size="small"
                className={`workbook-session__toolbar-icon ${
                  !isParticipantsCollapsed ? "is-active" : ""
                }`}
                onClick={onToggleParticipantsCollapsed}
              >
                <GroupRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
