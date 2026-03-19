import { Suspense, lazy, type CSSProperties } from "react";
import { WorkbookSessionUtilityPanelChrome } from "./WorkbookSessionUtilityPanelChrome";
import { WorkbookSessionUtilityPanelTabs } from "./WorkbookSessionUtilityPanelTabs";
import { WorkbookSessionChatPanel } from "./WorkbookSessionChatPanel";
import { WorkbookSessionOverlays } from "./WorkbookSessionOverlays";
import type { WorkbookSessionParticipantsPanelProps } from "./WorkbookSessionParticipantsPanel";

const WorkbookSessionParticipantsPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionParticipantsPanel")).WorkbookSessionParticipantsPanel,
}));

type WorkbookSessionSidebarProps = {
  isCompactViewport: boolean;
  showSidebarParticipants: boolean;
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
  floatingPanelsTop,
  participantsPanelProps,
  utilityPanelChromeProps,
  utilityPanelTabsProps,
  sessionChatPanelProps,
  overlaysProps,
}: WorkbookSessionSidebarProps) {
  return (
    <aside
      className="workbook-session__sidebar"
      style={
        !isCompactViewport && showSidebarParticipants
          ? ({
              ["--workbook-floating-top" as string]: `${floatingPanelsTop}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {showSidebarParticipants ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <p className="workbook-session__hint">Загрузка участников...</p>
            </div>
          }
        >
          <WorkbookSessionParticipantsPanel {...participantsPanelProps} />
        </Suspense>
      ) : null}

      <WorkbookSessionUtilityPanelChrome {...utilityPanelChromeProps}>
        <WorkbookSessionUtilityPanelTabs {...utilityPanelTabsProps} />
      </WorkbookSessionUtilityPanelChrome>

      <WorkbookSessionChatPanel {...sessionChatPanelProps} />

      <WorkbookSessionOverlays {...overlaysProps} />
    </aside>
  );
}
