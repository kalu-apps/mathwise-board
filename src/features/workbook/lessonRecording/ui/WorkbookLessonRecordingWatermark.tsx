type WorkbookLessonRecordingWatermarkProps = {
  visible: boolean;
};

export function WorkbookLessonRecordingWatermark({
  visible,
}: WorkbookLessonRecordingWatermarkProps) {
  if (!visible) return null;
  return (
    <div className="workbook-session__recording-watermark" aria-hidden="true">
      Mathwise · Автор: Калугина Анна Викторовна
    </div>
  );
}
