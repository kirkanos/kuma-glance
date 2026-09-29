import { type Monitor, type MonitorStatus, monitorStatus } from "../kuma/model";
import { STATUS_LABEL } from "./theme";

export type Metric = "avgPing" | "ping" | "uptime24h" | "uptime30d";

export const METRIC_ORDER: Metric[] = ["avgPing", "ping", "uptime24h", "uptime30d"];

export function nextMetric(metric: Metric | undefined): Metric {
  const index = METRIC_ORDER.indexOf(metric ?? "avgPing");
  return METRIC_ORDER[(index + 1) % METRIC_ORDER.length];
}

const CAPTION: Record<Metric, string> = {
  avgPing: "avg ping 24h",
  ping: "current ping",
  uptime24h: "uptime 24h",
  uptime30d: "uptime 30d",
};

export type DisplayValue = { status: MonitorStatus; value: string; unit?: string; caption?: string };

function formatPercent(fraction: number): string {
  const percent = fraction * 100;
  if (percent >= 99.995) {
    return "100";
  }
  return percent.toLocaleString("en-US", { maximumFractionDigits: percent >= 99 ? 2 : 1 });
}

/** The big value shown for a monitor: the selected metric while up, otherwise its status. */
export function displayValue(monitor: Monitor, metric: Metric = "avgPing"): DisplayValue {
  const status = monitorStatus(monitor);
  if (status !== "up") {
    const caption = status === "down" ? "offline" : status === "unknown" ? "waiting for data" : undefined;
    return { status, value: STATUS_LABEL[status], caption };
  }

  switch (metric) {
    case "ping": {
      const ping = monitor.heartbeat?.ping;
      return { status, value: ping != null ? String(Math.round(ping)) : "–", unit: "ms", caption: CAPTION.ping };
    }
    case "uptime24h":
    case "uptime30d": {
      const fraction = metric === "uptime24h" ? monitor.uptime24h : monitor.uptime30d;
      return { status, value: fraction != null ? formatPercent(fraction) : "–", unit: "%", caption: CAPTION[metric] };
    }
    default:
      return {
        status,
        value: monitor.avgPing != null ? String(Math.round(monitor.avgPing)) : "–",
        unit: "ms",
        caption: CAPTION.avgPing,
      };
  }
}
