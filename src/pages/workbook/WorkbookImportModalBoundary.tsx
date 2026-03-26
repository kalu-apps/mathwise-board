import { Component, type ErrorInfo, type ReactNode } from "react";

type WorkbookImportModalBoundaryProps = {
  active: boolean;
  onReset?: () => void;
  children: ReactNode;
};

type WorkbookImportModalBoundaryState = {
  hasError: boolean;
};

export class WorkbookImportModalBoundary extends Component<
  WorkbookImportModalBoundaryProps,
  WorkbookImportModalBoundaryState
> {
  state: WorkbookImportModalBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): WorkbookImportModalBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[workbook][import-modal] crash guarded", error, errorInfo);
    this.props.onReset?.();
  }

  componentDidUpdate(prevProps: WorkbookImportModalBoundaryProps) {
    if (!this.state.hasError) return;
    if (prevProps.active && !this.props.active) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

