import { type Heartbeat, heartbeatStatus, type MonitorStatus, type TagCounts } from "../kuma/model";
import { background, mix, prefersLightText, ringSegment, svg, text, toDataUrl, truncate, wrapText } from "./svg";
import { STATUS_COLOR, THEME } from "./theme";

/** Key images are drawn at 144×144 and scaled by Stream Deck. */
const S = 144;

function statusBackground(status: MonitorStatus): string {
  const color = STATUS_COLOR[status];
  if (status === "down") {
    return background("bg", mix(color, "#000000", 0.05), mix(color, THEME.base, 0.55), S, S);
  }
  if (status === "paused" || status === "unknown") {
    return background("bg", THEME.surface, THEME.base, S, S);
  }
  return background("bg", mix(color, THEME.base, 0.72), THEME.base, S, S);
}

/** Row of the most recent heartbeats, colored like in the Uptime Kuma UI. */
export function heartbeatStrip(beats: Heartbeat[], x: number, y: number, width: number, height: number, count: number): string {
  const gap = Math.max(2, Math.round(width / count / 4));
  const barWidth = (width - gap * (count - 1)) / count;
  const recent = beats.slice(-count);
  const padded: (Heartbeat | undefined)[] = [...Array(count - recent.length).fill(undefined), ...recent];
  return padded
    .map((beat, i) => {
      const fill = beat ? STATUS_COLOR[heartbeatStatus(beat)] : THEME.muted;
      const opacity = beat ? 1 : 0.6;
      return `<rect x="${(x + i * (barWidth + gap)).toFixed(1)}" y="${y}" width="${barWidth.toFixed(1)}" height="${height}" rx="${Math.min(2, barWidth / 2).toFixed(1)}" fill="${fill}" fill-opacity="${opacity}"/>`;
    })
    .join("");
}

export type MonitorKey = {
  /** Monitor name; omitted when the user shows their own title on the key. */
  name?: string;
  status: MonitorStatus;
  value: string;
  unit?: string;
  caption?: string;
  beats: Heartbeat[];
  /** Allow three name lines (tag folder slots) instead of two. */
  compact?: boolean;
};

// Baselines for value / caption depending on the number of name lines.
const VALUE_Y = [78, 86, 94, 104];
const CAPTION_Y = [100, 106, 113, 0];

export function monitorKey(k: MonitorKey): string {
  const lines = k.name ? wrapText(k.name, k.compact ? 12 : 11, k.compact ? 3 : 2) : [];
  const nameSize = lines.length > 2 ? 17 : 19;
  const lineHeight = nameSize + 2;

  const accent = k.status === "down" ? "" : `<rect x="0" y="0" width="${S}" height="5" fill="${STATUS_COLOR[k.status]}"/>`;
  const names = lines.map((line, i) => text(line, { x: S / 2, y: 28 + i * lineHeight, size: nameSize })).join("");

  const long = k.value.length + (k.unit ? k.unit.length / 2 : 0) > 5;
  const valueSize = Math.round((lines.length > 2 ? 26 : 34) * (long ? 0.8 : 1));
  const value = text(k.value, {
    x: S / 2,
    y: VALUE_Y[lines.length],
    size: valueSize,
    weight: 800,
    suffix: k.unit,
    suffixSize: Math.round(valueSize * 0.5),
  });
  const caption =
    k.caption && CAPTION_Y[lines.length]
      ? text(k.caption, { x: S / 2, y: CAPTION_Y[lines.length], size: 14, weight: 600, opacity: 0.7 })
      : "";

  const strip = heartbeatStrip(k.beats, 10, 122, S - 20, 12, 12);
  return toDataUrl(svg(S, S, statusBackground(k.status) + accent + names + value + caption + strip));
}

export function tagSummaryKey(tagName: string, counts: TagCounts): string {
  const tagColor = counts.color || THEME.accent;
  const hasDown = counts.down > 0;

  const bg = hasDown
    ? background("bg", mix(STATUS_COLOR.down, "#000000", 0.05), mix(STATUS_COLOR.down, THEME.base, 0.55), S, S)
    : background("bg", THEME.surface, THEME.base, S, S);

  const header =
    `<rect x="8" y="8" width="${S - 16}" height="30" rx="9" fill="${tagColor}"/>` +
    text(truncate(tagName, 11), { x: S / 2, y: 29, size: 17, fill: prefersLightText(tagColor) ? "#FFFFFF" : "#0B1220" });

  // Donut: up / down / other (paused, pending, maintenance).
  const cx = S / 2;
  const cy = 92;
  const r = 34;
  const stroke = 11;
  let ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${hasDown ? "#000000" : THEME.muted}" stroke-opacity="${hasDown ? 0.25 : 1}" stroke-width="${stroke}"/>`;
  const parts: [number, string][] = [
    [counts.up, STATUS_COLOR.up],
    [counts.down, hasDown ? "#FFFFFF" : STATUS_COLOR.down],
    [counts.other, STATUS_COLOR.paused],
  ];
  let angle = 0;
  for (const [count, color] of parts) {
    if (count <= 0) {
      continue;
    }
    const sweep = (count / counts.total) * 360;
    ring +=
      sweep >= 359.9
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`
        : `<path d="${ringSegment(cx, cy, r, angle + 1.5, angle + sweep - 1.5)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`;
    angle += sweep;
  }

  const [number, label] = hasDown
    ? [counts.down, "down"]
    : counts.total === 0
      ? [0, "monitors"]
      : [counts.up, counts.up === counts.total ? "all up" : `of ${counts.total}`];

  const center =
    text(String(number), { x: cx, y: cy + 7, size: 28, weight: 800 }) +
    text(label, { x: cx, y: cy + 22, size: 11, weight: 600, opacity: 0.75 });

  return toDataUrl(svg(S, S, bg + header + ring + center));
}

function arrow(direction: "left" | "right"): string {
  const d =
    direction === "right"
      ? "M 40 66 H 100 M 80 46 L 100 66 L 80 86"
      : "M 104 66 H 44 M 64 46 L 44 66 L 64 86";
  return `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function nextPageKey(page: number, pageCount: number): string {
  return toDataUrl(
    svg(
      S,
      S,
      background("bg", mix(THEME.accent, THEME.base, 0.35), THEME.base, S, S) +
        arrow("right") +
        text(`${page} / ${pageCount}`, { x: S / 2, y: 124, size: 18, weight: 700, opacity: 0.85 }),
    ),
  );
}

export function backKey(): string {
  return toDataUrl(
    svg(S, S, background("bg", THEME.surface, THEME.base, S, S) + arrow("left") + text("Back", { x: S / 2, y: 124, size: 18, opacity: 0.85 })),
  );
}

export function emptyKey(): string {
  return toDataUrl(svg(S, S, `<rect width="${S}" height="${S}" fill="${THEME.empty}"/>`));
}

/** Neutral key with two lines of text, e.g. "Select / a monitor" or "Offline". */
export function messageKey(title: string, subtitle: string): string {
  return toDataUrl(
    svg(
      S,
      S,
      background("bg", THEME.surface, THEME.base, S, S) +
        `<rect x="3" y="3" width="${S - 6}" height="${S - 6}" rx="14" fill="none" stroke="${THEME.muted}" stroke-width="2"/>` +
        text(title, { x: S / 2, y: 68, size: 22, weight: 800 }) +
        text(subtitle, { x: S / 2, y: 92, size: 15, weight: 600, fill: THEME.subtle }),
    ),
  );
}
