import {
  useCallback,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { WorkbookPreparedDocumentImport } from "./useWorkbookSessionDocumentHandlers";

type UseWorkbookImportModalControllerParams = {
  canInsertImage: boolean;
  isEnded: boolean;
  importDocumentFile: (payload: WorkbookPreparedDocumentImport) => Promise<boolean>;
};

export const useWorkbookImportModalController = ({
  canInsertImage,
  isEnded,
  importDocumentFile,
}: UseWorkbookImportModalControllerParams) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pendingImportFiles, setPendingImportFiles] = useState<File[]>([]);

  const openImportModal = useCallback(
    (files?: File[]) => {
      if (!canInsertImage || isEnded) return;
      setPendingImportFiles(Array.isArray(files) ? files : []);
      setIsImportModalOpen(true);
    },
    [canInsertImage, isEnded]
  );

  const handleDocsUploadToModal = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!files.length) return;
      openImportModal(files);
    },
    [openImportModal]
  );

  const handleImportModalClose = useCallback(() => {
    setIsImportModalOpen(false);
    setPendingImportFiles([]);
  }, []);

  const handleImportModalFile = useCallback(
    (payload: WorkbookPreparedDocumentImport) => importDocumentFile(payload),
    [importDocumentFile]
  );

  const handleWorkspaceDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canInsertImage || isEnded) return;
      const hasFiles = Array.from(event.dataTransfer.types ?? []).includes("Files");
      if (!hasFiles) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [canInsertImage, isEnded]
  );

  const handleWorkspaceDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canInsertImage || isEnded) return;
      const files = Array.from(event.dataTransfer.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      openImportModal(files);
    },
    [canInsertImage, isEnded, openImportModal]
  );

  return {
    isImportModalOpen,
    pendingImportFiles,
    openImportModal,
    handleDocsUploadToModal,
    handleImportModalClose,
    handleImportModalFile,
    handleWorkspaceDragOver,
    handleWorkspaceDrop,
  };
};
