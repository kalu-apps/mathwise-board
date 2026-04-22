import { Suspense, lazy, type CSSProperties } from "react";
import { WorkbookSessionUtilityPanelChrome } from "./WorkbookSessionUtilityPanelChrome";
import { WorkbookSessionUtilityPanelTabs } from "./WorkbookSessionUtilityPanelTabs";
import { WorkbookSessionChatPanel } from "./WorkbookSessionChatPanel";
import { WorkbookSessionOverlays } from "./WorkbookSessionOverlays";
import type {
  WorkbookParticipantsPanelMode,
  WorkbookSessionParticipantsPanelProps,
} from "./WorkbookSessionParticipantsPanel";
import { InlineMobiusLoader } from "@/shared/ui/loading";

const WorkbookSessionParticipantsPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionParticipantsPanel")).WorkbookSessionParticipantsPanel,
}));

type WorkbookSessionSidebarProps = {
  isCompactViewport: boolean;
  showSidebarParticipants: boolean;
  participantsPanelMode: WorkbookParticipantsPanelMode;
  floatingPanelsTop: number;
  participantsPanelProps: WorkbookSessionParticipantsPanelProps;
  utilityPanelChromeProps: Omit<
    React.ComponentProps<typeof WorkbookSessionUtilityPanelChrome>,
    "children"
  >;
  utilityPanelTabsProps: React.ComponentProps<typeof WorkbookSessionUtilityPanelTabs>;
  sessionChatPanelProps: React.ComponentProps<typeof WorkbookSessionChatPanel>;
  overlaysProps: React.ComponentProps<typeof WorkbookSessionOverlays>;
};

export function WorkbookSessionSidebar({
  isCompactViewport,
  showSidebarParticipants,
  participantsPanelMode,
  floatingPanelsTop,
  participantsPanelProps,
  utilityPanelChromeProps,
  utilityPanelTabsProps,
  sessionChatPanelProps,
  overlaysProps,
}: WorkbookSessionSidebarProps) {
  const isVideoOnlyMode = participantsPanelMode === "video_only";
  return (
    <>
      {showSidebarParticipants ? (
        <div
          className={`workbook-session__sidebar workbook-session__sidebar--participants ${
            participantsPanelMode === "expanded"
              ? "mode-expanded"
              : participantsPanelMode === "video_only"
                ? "mode-video-only"
                : "mode-sidebar"
          }`}
          style={
            !isCompactViewport && !isVideoOnlyMode
              ? ({
                  ["--workbook-floating-top" as string]: `${floatingPanelsTop}px`,
                } as CSSProperties)
              : undefined
          }
        >
          <Suspense
            fallback={
              <div className="workbook-session__card">
                <InlineMobiusLoader
                  size="compact"
                  label="Загрузка участников..."
                  centered
                />
              </div>
            }
          >
            <WorkbookSessionParticipantsPanel
              {...participantsPanelProps}
              isCompactViewport={isCompactViewport}
            />
          </Suspense>
        </div>
      ) : null}

      {!isVideoOnlyMode ? (
        <WorkbookSessionUtilityPanelChrome {...utilityPanelChromeProps}>
          <WorkbookSessionUtilityPanelTabs {...utilityPanelTabsProps} />
        </WorkbookSessionUtilityPanelChrome>
      ) : null}

      {!isVideoOnlyMode ? <WorkbookSessionChatPanel {...sessionChatPanelProps} /> : null}

      <WorkbookSessionOverlays {...overlaysProps} />
    </>
  );
}
