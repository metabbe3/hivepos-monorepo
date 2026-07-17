"use client";

import { Component, type ReactNode } from "react";

// Per-card error boundary for the dashboard. During the port, some cards fetch their
// own endpoints (kanban, heatmap) whose Go shapes may not match yet — one crashing card
// shouldn't take down the whole page. A failed card renders nothing (graceful hole).
// ponytail: broad safety net; remove once all dashboard endpoints align.
export class CardBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[dashboard card] crashed — hiding card", err);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
