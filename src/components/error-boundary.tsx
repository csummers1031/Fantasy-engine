"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  label: string;
}

interface State {
  error: string;
}

export class PanelErrorBoundary extends Component<Props, State> {
  override state: State = { error: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[panel:${this.props.label}]`, error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== "") {
      return (
        <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border border-desk-down/40 bg-desk-down/10 p-3 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4" />
          <div className="font-semibold">{this.props.label} panel isolated</div>
          <div className="text-center text-[11px] opacity-80">{this.state.error}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
