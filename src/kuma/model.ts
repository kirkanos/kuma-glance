/** Data model of the monitors reported by Uptime Kuma. */

export type Tag = { name: string; color?: string };

/** Kuma heartbeat status codes. */
export const HEARTBEAT = { DOWN: 0, UP: 1, PENDING: 2, MAINTENANCE: 3 } as const;

export type Heartbeat = {
  status: number;
  ping?: number | null;
  time?: string;
  msg?: string;
};

export type Monitor = {
  id: string;
  name: string;
  active: boolean;
  tags: Tag[];
  heartbeat?: Heartbeat;
  /** Most recent heartbeats, oldest first (for the heartbeat strip). */
  beats: Heartbeat[];
  avgPing?: number;
  uptime24h?: number;
  uptime30d?: number;
};

export type MonitorStatus = "up" | "down" | "pending" | "maintenance" | "paused" | "unknown";

export const MAX_BEATS = 30;

export function monitorStatus(monitor: Monitor): MonitorStatus {
  if (!monitor.active) {
    return "paused";
  }
  return heartbeatStatus(monitor.heartbeat);
}

export function heartbeatStatus(beat: Heartbeat | undefined): MonitorStatus {
  switch (beat?.status) {
    case HEARTBEAT.UP:
      return "up";
    case HEARTBEAT.DOWN:
      return "down";
    case HEARTBEAT.PENDING:
      return "pending";
    case HEARTBEAT.MAINTENANCE:
      return "maintenance";
    default:
      return "unknown";
  }
}

export type TagCounts = { up: number; down: number; other: number; total: number; color?: string };

export function countByStatus(monitors: Monitor[], tagName: string): TagCounts {
  const counts: TagCounts = { up: 0, down: 0, other: 0, total: 0 };
  for (const monitor of monitors) {
    const tag = monitor.tags.find((t) => t.name === tagName);
    if (!tag) {
      continue;
    }
    counts.color ??= tag.color;
    counts.total++;
    const status = monitorStatus(monitor);
    if (status === "up") {
      counts.up++;
    } else if (status === "down") {
      counts.down++;
    } else {
      counts.other++;
    }
  }
  return counts;
}

export const byName = (a: Monitor, b: Monitor) => a.name.localeCompare(b.name);
