/**
 * Renders docs/preview.png (1920 × 960, the Marketplace thumbnail size) from
 * the real key and dial renderers, with sample monitors.
 *
 * Usage: npm run preview
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Heartbeat } from "../src/kuma/model";
import { dialCanvas } from "../src/render/dial";
import { monitorKey, tagSummaryKey } from "../src/render/keys";
import { FONT } from "../src/render/svg";

const beats = (pattern: string): Heartbeat[] => [...pattern].map((c) => ({ status: Number(c) }));
const up = beats("111111111111");

const keys = [
  monitorKey({ name: "Nextcloud", status: "up", value: "42", unit: "ms", caption: "avg ping 24h", beats: up }),
  monitorKey({ name: "Home Assistant", status: "up", value: "99.98", unit: "%", caption: "uptime 30d", beats: beats("111111101111") }),
  monitorKey({ name: "Mail Server", status: "down", value: "DOWN", caption: "offline", beats: beats("111111110000") }),
  tagSummaryKey("Homelab", { up: 11, down: 0, other: 1, total: 12, color: "#10B981" }),
  monitorKey({ name: "Grafana", status: "paused", value: "PAUSED", beats: beats("111111") }),
  monitorKey({ name: "Backup NAS", status: "up", value: "8", unit: "ms", caption: "current ping", beats: up }),
  tagSummaryKey("Production", { up: 7, down: 2, other: 0, total: 9, color: "#F59E0B" }),
  monitorKey({ name: "Reverse Proxy", status: "maintenance", value: "MAINT.", beats: beats("111113333") }),
];
const dials = [
  dialCanvas({ title: "Home Assistant", status: "up", value: "42", unit: "ms", caption: "avg ping 24h", beats: up }),
  dialCanvas({ title: "Mail Server", status: "down", value: "DOWN", caption: "offline", beats: beats("111110000") }),
];

const KEY = 190;
const GAP = 26;
const gridX = 860;
const gridY = 120;
let n = 0;
/** Inlines a key/dial image (data URL) as nested SVG; resvg does not load fonts inside <image>. */
const image = (href: string, x: number, y: number, w: number, h: number, r: number) => {
  const id = `k${n++}`;
  const inner = Buffer.from(href.split(",")[1], "base64")
    .toString("utf8")
    .replace(/id="bg"/g, `id="${id}"`)
    .replace(/url\(#bg\)/g, `url(#${id})`)
    .replace(/<svg [^>]*viewBox="([^"]+)"[^>]*>/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="$1">`);
  return `<clipPath id="c${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><g clip-path="url(#c${id})">${inner}</g>`;
};

const keyImages = keys
  .map((href, i) => image(href, gridX + (i % 4) * (KEY + GAP), gridY + Math.floor(i / 4) * (KEY + GAP), KEY, KEY, 22))
  .join("");
const dialImages = dials.map((href, i) => image(href, gridX + i * (400 + GAP), gridY + 2 * (KEY + GAP) + 30, 400, 200, 22)).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="960" viewBox="0 0 1920 960">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
  <rect width="1920" height="960" fill="url(#bg)"/>
  <path d="M120 300h70l26-64 42 128 32-88 20 24h70" fill="none" stroke="#22C55E" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="120" y="470" font-family="${FONT}" font-size="104" font-weight="800" fill="#FFFFFF">Kuma Glance</text>
  <text x="124" y="540" font-family="${FONT}" font-size="38" font-weight="500" fill="#94A3B8">Your Uptime Kuma monitors at a glance</text>
  <text x="124" y="600" font-family="${FONT}" font-size="30" font-weight="500" fill="#64748B">Status · ping · uptime · tag summaries · tag folders</text>
  ${keyImages}${dialImages}
</svg>`;

const out = path.resolve(import.meta.dirname, "..", "docs", "preview.png");
fs.writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
console.log(`wrote ${path.relative(process.cwd(), out)}`);
