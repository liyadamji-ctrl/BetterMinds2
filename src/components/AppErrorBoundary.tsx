"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  /** Which feature this boundary protects — shows up in the fallback and in logs. */
  scope: string;
  children: ReactNode;
};

type State = { hasError: boolean };

/**
 * Wrap any feature in this and a crash inside it can never take down the
 * rest of the page. React error boundaries must be class components —
 * there's no hook for this yet — so this is the one class component in
 * the codebase, and it's meant to be reused everywhere, not written twice.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Best-effort: tell the server so it lands in logs/app.log. If this
    // fails (offline, etc.) the fallback UI below still renders fine.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: this.props.scope,
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      }),
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">This part of the page ({this.props.scope}) hit a problem.</p>
          <p className="mt-1 text-amber-700">
            The rest of the app is unaffected — try reloading just this section.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
