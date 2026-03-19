import { memo } from "react";
import { Button, IconButton, Tooltip } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FilterCenterFocusRoundedIcon from "@mui/icons-material/FilterCenterFocusRounded";
import type { WorkbookBoardObject, WorkbookSceneLayer } from "@/features/workbook/model/types";

export type WorkbookSessionLayersPanelProps = {
  layers: Array<{
    layer: WorkbookSceneLayer;
    objects: WorkbookBoardObject[];
  }>;
  getObjectTypeLabel: (object: WorkbookBoardObject) => string;
  onDissolveLayer: (layerId: string) => void;
  onFocusObject: (objectId: string) => void;
  onRemoveObject: (objectId: string, layerId: string) => void;
  onDeleteObject: (objectId: string) => void;
};

export const WorkbookSessionLayersPanel = memo(function WorkbookSessionLayersPanel({
  layers,
  getObjectTypeLabel,
  onDissolveLayer,
  onFocusObject,
  onRemoveObject,
  onDeleteObject,
}: WorkbookSessionLayersPanelProps) {
  return (
    <div className="workbook-session__card">
      <h3>Слои</h3>
      <div className="workbook-session__settings">
        <div className="workbook-session__solid-card-list workbook-session__solid-card-list--figure">
          {layers.length ? (
            layers.map(({ layer, objects }) => (
              <article key={layer.id} className="workbook-session__solid-card">
                <div className="workbook-session__solid-card-head">
                  <span className="workbook-session__solid-card-title">{layer.name}</span>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onDissolveLayer(layer.id)}
                  >
                    Расформировать
                  </Button>
                </div>
                <div className="workbook-session__layer-subcards">
                  {objects.map((object) => (
                    <div key={`${layer.id}-${object.id}`} className="workbook-session__layer-subcard">
                      <div className="workbook-session__layer-subcard-main">
                        <strong>{getObjectTypeLabel(object)}</strong>
                        <span>
                          {`#${object.id.slice(0, 6)} · ${Math.max(
                            1,
                            Math.round(Math.abs(object.width))
                          )}×${Math.max(1, Math.round(Math.abs(object.height)))}`}
                        </span>
                      </div>
                      <div className="workbook-session__solid-card-controls">
                        <Tooltip title="Подсветить на доске" arrow>
                          <span>
                            <IconButton size="small" onClick={() => onFocusObject(object.id)}>
                              <FilterCenterFocusRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Убрать из композиции" arrow>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => onRemoveObject(object.id, layer.id)}
                            >
                              <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Удалить с доски" arrow>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onDeleteObject(object.id)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="workbook-session__hint">
              Композиций пока нет. Выделите область и выберите «Объединить в композицию».
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
