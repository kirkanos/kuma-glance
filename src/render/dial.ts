import type { Heartbeat, MonitorStatus } from "../kuma/model";
import { heartbeatStrip } from "./keys";
import { background, mix, svg, text, toDataUrl, truncate } from "./svg";
import { STATUS_COLOR, THEME } from "./theme";

/** Touch strip segment of one dial (Stream Deck + / + XL). */
const W = 200;
const H = 100;

export type DialCanvas = {
  title: string;
  status: MonitorStatus;
  value: string;
  unit?: string;
  caption?: string;
  beats: Heartbeat[];
};

export function dialCanvas(d: DialCanvas): string {
  const color = STATUS_COLOR[d.status];
  const bg =
    d.status === "down"
      ? background("bg", mix(color, "#000000", 0.05), mix(color, THEME.base, 0.55), W, H)
      : background("bg", mix(color, THEME.base, 0.8), THEME.base, W, H);

  const dot = `<circle cx="16" cy="19" r="5" fill="${d.status === "down" ? "#FFFFFF" : color}"/>`;
  const title = text(truncate(d.title, 18), { x: 28, y: 25, size: 17, anchor: "start" });
  const value = text(d.value, {
    x: 12,
    y: 66,
    size: d.value.length > 5 ? 24 : 30,
    weight: 800,
    anchor: "start",
    suffix: d.unit,
    suffixSize: 15,
  });
  const caption = d.caption ? text(d.caption, { x: 12, y: 88, size: 13, weight: 600, opacity: 0.7, anchor: "start" }) : "";
  const strip = heartbeatStrip(d.beats, 122, 50, 66, 18, 8);

  return toDataUrl(svg(W, H, bg + dot + title + value + caption + strip));
}

export function dialMessage(title: string, subtitle: string): string {
  return toDataUrl(
    svg(
      W,
      H,
      background("bg", THEME.surface, THEME.base, W, H) +
        text(title, { x: 12, y: 44, size: 20, weight: 800, anchor: "start" }) +
        text(subtitle, { x: 12, y: 70, size: 14, weight: 600, fill: THEME.subtle, anchor: "start" }),
    ),
  );
}
