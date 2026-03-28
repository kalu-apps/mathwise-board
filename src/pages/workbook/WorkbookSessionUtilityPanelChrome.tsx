import {
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { IconButton } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import type { WorkbookPoint } from "@/features/workbook/model/types";
import type { WorkbookUtilityTab } from "@/features/workbook/model/workbookSessionUiTypes";

interface WorkbookSessionUtilityPanelChromeProps {
  isOpen: boolean;
  utilityPanelRef: MutableRefObject<HTMLDivElement | null>;
  isUtilityPanelCollapsed: boolean;
  isContextualUtilityPanel: boolean;
  utilityTab: WorkbookUtilityTab;
  isCompactViewport: boolean;
  utilityPanelPosition: WorkbookPoint;
  floatingPanelsTop: number;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  title: string;
  setIsUtilityPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  setIsUtilityPanelOpen: Dispatch<SetStateAction<boolean>>;
  children: ReactNode;
}

export function WorkbookSessionUtilityPanelChrome({
  isOpen,
  utilityPanelRef,
  isUtilityPanelCollapsed,
  isContextualUtilityPanel,
  utilityTab,
  isCompactViewport,
  utilityPanelPosition,
  floatingPanelsTop,
  onDragStart,
  title,
  setIsUtilityPanelCollapsed,
  setIsUtilityPanelOpen,
  children,
}: WorkbookSessionUtilityPanelChromeProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={utilityPanelRef}
      className={`workbook-session__utility-float${
        isUtilityPanelCollapsed ? " is-collapsed" : ""
      }${isContextualUtilityPanel ? " is-contextual" : ""}${
        utilityTab === "settings" ? " is-settings" : ""
      }${utilityTab === "transform" ? " is-transform" : ""
      }`}
      style={
        isCompactViewport
          ? undefined
          : {
              left: utilityPanelPosition.x,
              top: Math.max(utilityPanelPosition.y, floatingPanelsTop),
            }
      }
    >
      <div
        className="workbook-session__utility-float-head"
        onPointerDown={onDragStart}
      >
        <h3>
          <TuneRoundedIcon fontSize="small" />
          {title}
        </h3>
        <div className="workbook-session__utility-float-actions">
          <IconButton
            size="small"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setIsUtilityPanelCollapsed((current) => !current);
            }}
            title={isUtilityPanelCollapsed ? "Развернуть" : "Свернуть"}
          >
            {isUtilityPanelCollapsed ? (
              <UnfoldMoreRoundedIcon fontSize="small" />
            ) : (
              <UnfoldLessRoundedIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setIsUtilityPanelOpen(false);
            }}
            title="Закрыть"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
      {!isUtilityPanelCollapsed ? (
        <div className="workbook-session__utility-float-body">{children}</div>
      ) : null}
    </div>
  );
}
