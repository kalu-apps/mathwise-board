import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  DEFAULT_WORKBOOK_IMPORT_CROP_RECT,
  normalizeWorkbookImportCropRect,
  type WorkbookImportCropRect,
} from "./workbookImageImportCrop";

type WorkbookImageImportCropModalProps = {
  open: boolean;
  sourceDataUrl: string | null;
  fileName?: string;
  initialCropRect?: WorkbookImportCropRect | null;
  container?: Element | null;
  onCancel: () => void;
  onConfirm: (cropRect: WorkbookImportCropRect) => void;
};

type CropPointer = {
  x: number;
  y: number;
};

type CropResizeHandle = "nw" | "ne" | "sw" | "se";

type CropDragState =
  | {
      kind: "move";
      pointerId: number;
      startPoint: CropPointer;
      startCrop: WorkbookImportCropRect;
    }
  | {
      kind: "resize";
      pointerId: number;
      startPoint: CropPointer;
      startCrop: WorkbookImportCropRect;
      handle: CropResizeHandle;
    }
  | {
      kind: "create";
      pointerId: number;
      startPoint: CropPointer;
    };

const MIN_CROP_RATIO = 0.05;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const pointInsideCrop = (point: CropPointer, crop: WorkbookImportCropRect) =>
  point.x >= crop.x &&
  point.x <= crop.x + crop.width &&
  point.y >= crop.y &&
  point.y <= crop.y + crop.height;

const normalizeForDrag = (crop: WorkbookImportCropRect) => {
  const normalized = normalizeWorkbookImportCropRect(crop);
  return {
    x: clamp(normalized.x, 0, 1 - MIN_CROP_RATIO),
    y: clamp(normalized.y, 0, 1 - MIN_CROP_RATIO),
    width: clamp(normalized.width, MIN_CROP_RATIO, 1),
    height: clamp(normalized.height, MIN_CROP_RATIO, 1),
  };
};

const createCropFromPoints = (start: CropPointer, current: CropPointer) => {
  let left = Math.min(start.x, current.x);
  let right = Math.max(start.x, current.x);
  let top = Math.min(start.y, current.y);
  let bottom = Math.max(start.y, current.y);

  if (right - left < MIN_CROP_RATIO) {
    if (current.x >= start.x) {
      right = clamp(left + MIN_CROP_RATIO, 0, 1);
      left = clamp(right - MIN_CROP_RATIO, 0, 1 - MIN_CROP_RATIO);
    } else {
      left = clamp(right - MIN_CROP_RATIO, 0, 1 - MIN_CROP_RATIO);
      right = clamp(left + MIN_CROP_RATIO, MIN_CROP_RATIO, 1);
    }
  }
  if (bottom - top < MIN_CROP_RATIO) {
    if (current.y >= start.y) {
      bottom = clamp(top + MIN_CROP_RATIO, 0, 1);
      top = clamp(bottom - MIN_CROP_RATIO, 0, 1 - MIN_CROP_RATIO);
    } else {
      top = clamp(bottom - MIN_CROP_RATIO, 0, 1 - MIN_CROP_RATIO);
      bottom = clamp(top + MIN_CROP_RATIO, MIN_CROP_RATIO, 1);
    }
  }

  return normalizeForDrag({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
};

const resolveResizedCrop = (
  handle: CropResizeHandle,
  startCrop: WorkbookImportCropRect,
  deltaX: number,
  deltaY: number
) => {
  let left = startCrop.x;
  let top = startCrop.y;
  let right = startCrop.x + startCrop.width;
  let bottom = startCrop.y + startCrop.height;
  switch (handle) {
    case "nw":
      left = clamp(left + deltaX, 0, right - MIN_CROP_RATIO);
      top = clamp(top + deltaY, 0, bottom - MIN_CROP_RATIO);
      break;
    case "ne":
      right = clamp(right + deltaX, left + MIN_CROP_RATIO, 1);
      top = clamp(top + deltaY, 0, bottom - MIN_CROP_RATIO);
      break;
    case "sw":
      left = clamp(left + deltaX, 0, right - MIN_CROP_RATIO);
      bottom = clamp(bottom + deltaY, top + MIN_CROP_RATIO, 1);
      break;
    case "se":
      right = clamp(right + deltaX, left + MIN_CROP_RATIO, 1);
      bottom = clamp(bottom + deltaY, top + MIN_CROP_RATIO, 1);
      break;
  }
  return normalizeForDrag({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
};

export function WorkbookImageImportCropModal({
  open,
  sourceDataUrl,
  fileName,
  initialCropRect,
  container,
  onCancel,
  onConfirm,
}: WorkbookImageImportCropModalProps) {
  const [cropRect, setCropRect] = useState<WorkbookImportCropRect>(() =>
    normalizeForDrag(initialCropRect ?? DEFAULT_WORKBOOK_IMPORT_CROP_RECT)
  );
  const [dragState, setDragState] = useState<CropDragState | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setCropRect(normalizeForDrag(initialCropRect ?? DEFAULT_WORKBOOK_IMPORT_CROP_RECT));
    setDragState(null);
  }, [initialCropRect, open]);

  const resolvePointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    } satisfies CropPointer;
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!sourceDataUrl) return;
      const point = resolvePointer(event);
      if (!point) return;
      const target = event.target;
      const handleElement =
        target instanceof Element ? target.closest("[data-crop-handle]") : null;
      if (handleElement instanceof HTMLElement) {
        const handle = handleElement.dataset.cropHandle as CropResizeHandle | undefined;
        if (handle === "nw" || handle === "ne" || handle === "sw" || handle === "se") {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragState({
            kind: "resize",
            pointerId: event.pointerId,
            startPoint: point,
            startCrop: cropRect,
            handle,
          });
          return;
        }
      }
      if (pointInsideCrop(point, cropRect)) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragState({
          kind: "move",
          pointerId: event.pointerId,
          startPoint: point,
          startCrop: cropRect,
        });
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setCropRect(
        createCropFromPoints(point, {
          x: point.x + MIN_CROP_RATIO,
          y: point.y + MIN_CROP_RATIO,
        })
      );
      setDragState({
        kind: "create",
        pointerId: event.pointerId,
        startPoint: point,
      });
    },
    [cropRect, resolvePointer, sourceDataUrl]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const point = resolvePointer(event);
      if (!point) return;
      if (dragState.kind === "create") {
        setCropRect(createCropFromPoints(dragState.startPoint, point));
        return;
      }
      if (dragState.kind === "move") {
        const deltaX = point.x - dragState.startPoint.x;
        const deltaY = point.y - dragState.startPoint.y;
        const width = dragState.startCrop.width;
        const height = dragState.startCrop.height;
        setCropRect(
          normalizeForDrag({
            x: clamp(dragState.startCrop.x + deltaX, 0, 1 - width),
            y: clamp(dragState.startCrop.y + deltaY, 0, 1 - height),
            width,
            height,
          })
        );
        return;
      }
      const deltaX = point.x - dragState.startPoint.x;
      const deltaY = point.y - dragState.startPoint.y;
      setCropRect(
        resolveResizedCrop(dragState.handle, dragState.startCrop, deltaX, deltaY)
      );
    },
    [dragState, resolvePointer]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }, [dragState]);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }, [dragState]);

  const cropPercentLabel = useMemo(
    () => `${Math.round(cropRect.width * 100)}% × ${Math.round(cropRect.height * 100)}%`,
    [cropRect.height, cropRect.width]
  );

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      container={container}
      fullWidth
      maxWidth="md"
      className="workbook-session__image-crop-modal"
      PaperProps={{ className: "workbook-session__image-crop-modal-paper" }}
    >
      <DialogTitle className="workbook-session__image-crop-modal-title">
        <span>Предпросмотр и обрезка изображения</span>
        <IconButton
          className="workbook-session__image-crop-modal-close"
          onClick={onCancel}
          aria-label="Закрыть окно обрезки"
          size="small"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="workbook-session__image-crop-modal-content">
        <Alert severity="info" className="workbook-session__image-crop-modal-alert">
          Выберите нужную область. В доску будет импортирован только обрезанный фрагмент.
        </Alert>
        {fileName ? (
          <div className="workbook-session__image-crop-file-name" title={fileName}>
            {fileName}
          </div>
        ) : null}
        <div className="workbook-session__image-crop-meta">
          <span>Область: {cropPercentLabel}</span>
        </div>
        <div className="workbook-session__image-crop-preview-shell">
          {sourceDataUrl ? (
            <div
              ref={surfaceRef}
              className="workbook-session__image-crop-surface"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              <img
                src={sourceDataUrl}
                alt={fileName ?? "preview"}
                className="workbook-session__image-crop-preview-image"
                draggable={false}
              />
              <div
                className="workbook-session__image-crop-rect"
                style={{
                  left: `${cropRect.x * 100}%`,
                  top: `${cropRect.y * 100}%`,
                  width: `${cropRect.width * 100}%`,
                  height: `${cropRect.height * 100}%`,
                }}
              >
                <button
                  type="button"
                  data-crop-handle="nw"
                  className="workbook-session__image-crop-handle is-nw"
                  aria-label="Изменить левый верхний угол"
                />
                <button
                  type="button"
                  data-crop-handle="ne"
                  className="workbook-session__image-crop-handle is-ne"
                  aria-label="Изменить правый верхний угол"
                />
                <button
                  type="button"
                  data-crop-handle="sw"
                  className="workbook-session__image-crop-handle is-sw"
                  aria-label="Изменить левый нижний угол"
                />
                <button
                  type="button"
                  data-crop-handle="se"
                  className="workbook-session__image-crop-handle is-se"
                  aria-label="Изменить правый нижний угол"
                />
              </div>
            </div>
          ) : (
            <div className="workbook-session__image-crop-fallback">
              Предпросмотр изображения недоступен.
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(normalizeForDrag(cropRect))}
          disabled={!sourceDataUrl}
        >
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
