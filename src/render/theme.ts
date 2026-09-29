import type { MonitorStatus } from "../kuma/model";

/** Colors shared by all key and dial images. */
export const THEME = {
  base: "#0B1220",
  surface: "#1E293B",
  muted: "#334155",
  subtle: "#94A3B8",
  empty: "#070B14",
  accent: "#6366F1",
};

export const STATUS_COLOR: Record<MonitorStatus, string> = {
  up: "#22C55E",
  down: "#EF4444",
  pending: "#F59E0B",
  maintenance: "#3B82F6",
  paused: "#64748B",
  unknown: "#475569",
};

export const STATUS_LABEL: Record<MonitorStatus, string> = {
  up: "UP",
  down: "DOWN",
  pending: "PENDING",
  maintenance: "MAINT.",
  paused: "PAUSED",
  unknown: "…",
};
