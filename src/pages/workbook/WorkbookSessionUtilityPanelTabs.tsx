import { Suspense, lazy, memo } from "react";
import type { WorkbookSessionBoardSettingsPanelProps } from "./WorkbookSessionBoardSettingsPanel";
import type { WorkbookSessionGraphPanelProps } from "./WorkbookSessionGraphPanel";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";
import type { WorkbookUtilityTab } from "@/features/workbook/model/workbookSessionUiTypes";
import { InlineMobiusLoader } from "@/shared/ui/loading";

const WorkbookSessionBoardSettingsPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionBoardSettingsPanel")).WorkbookSessionBoardSettingsPanel,
}));

const WorkbookSessionGraphPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionGraphPanel")).WorkbookSessionGraphPanel,
}));

const WorkbookSessionTransformPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionTransformPanel")).WorkbookSessionTransformPanel,
}));

type WorkbookSessionUtilityPanelTabsProps = {
  utilityTab: WorkbookUtilityTab;
  selectedObjectSupportsGraphPanel: boolean;
  selectedObjectSupportsTransformPanel: boolean;
  settingsPanelProps: WorkbookSessionBoardSettingsPanelProps;
  graphPanelProps: WorkbookSessionGraphPanelProps;
  transformPanelProps: WorkbookSessionTransformPanelProps;
};

export const WorkbookSessionUtilityPanelTabs = memo(function WorkbookSessionUtilityPanelTabs({
  utilityTab,
  selectedObjectSupportsGraphPanel,
  selectedObjectSupportsTransformPanel,
  settingsPanelProps,
  graphPanelProps,
  transformPanelProps,
}: WorkbookSessionUtilityPanelTabsProps) {
  return (
    <>
      {utilityTab === "settings" ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <InlineMobiusLoader
                size="compact"
                label="Загрузка панели настроек..."
                centered
              />
            </div>
          }
        >
          <WorkbookSessionBoardSettingsPanel {...settingsPanelProps} />
        </Suspense>
      ) : null}

      {utilityTab === "graph" && selectedObjectSupportsGraphPanel ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <InlineMobiusLoader
                size="compact"
                label="Загрузка панели графиков..."
                centered
              />
            </div>
          }
        >
          <WorkbookSessionGraphPanel {...graphPanelProps} />
        </Suspense>
      ) : null}

      {utilityTab === "transform" && selectedObjectSupportsTransformPanel ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <InlineMobiusLoader
                size="compact"
                label="Загрузка панели трансформаций..."
                centered
              />
            </div>
          }
        >
          <WorkbookSessionTransformPanel {...transformPanelProps} />
        </Suspense>
      ) : null}
    </>
  );
});
