import { useCallback, useMemo, useState } from "react";

type ConfirmTone = "neutral" | "warning" | "destructive";

type ConfirmAction =
  | { kind: "clear_board" }
  | { kind: "export_pdf" }
  | { kind: "delete_page"; page: number };

type UseWorkbookSessionConfirmActionsParams = {
  canClear: boolean;
  isEnded: boolean;
  exportingSections: boolean;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
  handleMenuClearBoard: () => Promise<void> | void;
  exportBoardAsPdf: () => Promise<void> | void;
  handleDeleteBoardPage: (page: number) => Promise<void> | void;
};

type ConfirmDialogContent = {
  title: string;
  description: string;
  confirmLabel: string;
  tone: ConfirmTone;
};

export const useWorkbookSessionConfirmActions = ({
  canClear,
  isEnded,
  exportingSections,
  setMenuAnchor,
  handleMenuClearBoard,
  exportBoardAsPdf,
  handleDeleteBoardPage,
}: UseWorkbookSessionConfirmActionsParams) => {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmActionSubmitting, setConfirmActionSubmitting] = useState(false);

  const handleRequestClearBoard = useCallback(() => {
    if (!canClear || isEnded) return;
    setMenuAnchor(null);
    setConfirmAction({ kind: "clear_board" });
  }, [canClear, isEnded, setMenuAnchor]);

  const handleRequestExportPdf = useCallback(() => {
    setMenuAnchor(null);
    if (exportingSections) return;
    setConfirmAction({ kind: "export_pdf" });
  }, [exportingSections, setMenuAnchor]);

  const handleRequestDeleteBoardPage = useCallback((page: number) => {
    setConfirmAction({ kind: "delete_page", page });
  }, []);

  const handleCloseConfirmDialog = useCallback(() => {
    if (confirmActionSubmitting) return;
    setConfirmAction(null);
  }, [confirmActionSubmitting]);

  const handleConfirmDialogAction = useCallback(async () => {
    if (!confirmAction) return;
    setConfirmActionSubmitting(true);
    try {
      if (confirmAction.kind === "clear_board") {
        await handleMenuClearBoard();
      } else if (confirmAction.kind === "export_pdf") {
        await exportBoardAsPdf();
      } else {
        await handleDeleteBoardPage(confirmAction.page);
      }
    } finally {
      setConfirmActionSubmitting(false);
      setConfirmAction(null);
    }
  }, [confirmAction, exportBoardAsPdf, handleDeleteBoardPage, handleMenuClearBoard]);

  const confirmDialogContent = useMemo<ConfirmDialogContent | null>(() => {
    if (!confirmAction) return null;
    if (confirmAction.kind === "clear_board") {
      return {
        title: "Очистить доску?",
        description:
          "Это действие удалит все объекты и штрихи с текущего рабочего слоя для всех участников.",
        confirmLabel: "Очистить",
        tone: "destructive",
      };
    }
    if (confirmAction.kind === "export_pdf") {
      return {
        title: "Экспортировать в PDF?",
        description: "Будет запущен экспорт текущего содержимого доски в PDF-файл.",
        confirmLabel: "Экспортировать",
        tone: "warning",
      };
    }
    return {
      title: `Удалить страницу ${confirmAction.page}?`,
      description:
        "Контент страницы будет удален, а следующие страницы автоматически сдвинутся.",
      confirmLabel: "Удалить",
      tone: "destructive",
    };
  }, [confirmAction]);

  return {
    confirmDialogOpen: Boolean(confirmAction),
    confirmDialogContent,
    confirmActionSubmitting,
    handleRequestClearBoard,
    handleRequestExportPdf,
    handleRequestDeleteBoardPage,
    handleCloseConfirmDialog,
    handleConfirmDialogAction,
  };
};
