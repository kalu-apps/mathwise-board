import { Suspense, lazy, memo } from "react";
import type { WorkbookSessionBoardSettingsPanelProps } from "./WorkbookSessionBoardSettingsPanel";
import type { WorkbookSessionGraphPanelProps } from "./WorkbookSessionGraphPanel";
import type { WorkbookSessionLayersPanelProps } from "./WorkbookSessionLayersPanel";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";
import type { WorkbookUtilityTab } from "@/features/workbook/model/workbookSessionUiTypes";

const WorkbookSessionBoardSettingsPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionBoardSettingsPanel")).WorkbookSessionBoardSettingsPanel,
}));

const WorkbookSessionGraphPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionGraphPanel")).WorkbookSessionGraphPanel,
}));

const WorkbookSessionLayersPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionLayersPanel")).WorkbookSessionLayersPanel,
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
  layersPanelProps: WorkbookSessionLayersPanelProps;
  transformPanelProps: WorkbookSessionTransformPanelProps;
};

export const WorkbookSessionUtilityPanelTabs = memo(function WorkbookSessionUtilityPanelTabs({
  utilityTab,
  selectedObjectSupportsGraphPanel,
  selectedObjectSupportsTransformPanel,
  settingsPanelProps,
  graphPanelProps,
  layersPanelProps,
  transformPanelProps,
}: WorkbookSessionUtilityPanelTabsProps) {
  return (
    <>
      {utilityTab === "settings" ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <p className="workbook-session__hint">Загрузка панели настроек...</p>
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
              <p className="workbook-session__hint">Загрузка панели графиков...</p>
            </div>
          }
        >
          <WorkbookSessionGraphPanel {...graphPanelProps} />
        </Suspense>
      ) : null}

      {utilityTab === "layers" ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <p className="workbook-session__hint">Загрузка панели слоёв...</p>
            </div>
          }
        >
          <WorkbookSessionLayersPanel {...layersPanelProps} />
        </Suspense>
      ) : null}

      {utilityTab === "transform" && selectedObjectSupportsTransformPanel ? (
        <Suspense
          fallback={
            <div className="workbook-session__card">
              <p className="workbook-session__hint">Загрузка панели трансформаций...</p>
            </div>
          }
        >
          <WorkbookSessionTransformPanel {...transformPanelProps} />
        </Suspense>
      ) : null}
    </>
  );
});
