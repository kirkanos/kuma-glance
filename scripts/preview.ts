/**
 * Renders the README preview and the Marketplace gallery images (all 1920 × 960)
 * from the real key and dial renderers, with sample monitors:
 *   docs/preview.png           overview (also the Marketplace thumbnail)
 *   docs/gallery/*.png         gallery images
 *   docs/icon/icon-<size>.png  plugin icon (assets/icon.svg) as PNG
 *
 * Usage: npm run preview
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Heartbeat } from "../src/kuma/model";
import { dialCanvas } from "../src/render/dial";
import { backKey, emptyKey, monitorKey, nextPageKey, tagSummaryKey } from "../src/render/keys";
import { escapeXml, FONT } from "../src/render/svg";

const W = 1920;
const H = 960;
const docs = path.resolve(import.meta.dirname, "..", "docs");

const beats = (pattern: string): Heartbeat[] => [...pattern].map((c) => ({ status: Number(c) }));
const up = beats("111111111111");

let nextId = 0;
/** Inlines a key/dial image (data URL) as nested SVG; resvg does not load fonts inside <image>. */
function place(href: string, x: number, y: number, w: number, h: number, radius: number): string {
  const id = `i${nextId++}`;
  const inner = Buffer.from(href.split(",")[1], "base64")
    .toString("utf8")
    .replace(/id="bg"/g, `id="${id}"`)
    .replace(/url\(#bg\)/g, `url(#${id})`)
    .replace(/<svg [^>]*viewBox="([^"]+)"[^>]*>/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="$1">`);
  return `<clipPath id="c${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}"/></clipPath><g clip-path="url(#c${id})">${inner}</g>`;
}

function label(text: string, x: number, y: number, size: number, fill: string, weight = 600, anchor = "start"): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}

const PULSE = "M0 0h70l26-64 42 128 32-88 20 24h70";

function page(body: string, title?: string, subtitle?: string): string {
  const heading = title
    ? `<path d="${PULSE}" transform="translate(120 118) scale(0.45)" fill="none" stroke="#22C55E" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>` +
      label(title, 260, 128, 64, "#FFFFFF", 800) +
      (subtitle ? label(subtitle, 262, 182, 32, "#94A3B8", 500) : "")
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#page)"/>${heading}${body}</svg>`
  );
}

function write(file: string, svg: string): void {
  const out = path.join(docs, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}

// 1. Overview (README + Marketplace thumbnail)
function overview(): string {
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
  const x0 = 860;
  const y0 = 120;
  const body =
    `<path d="${PULSE}" transform="translate(120 300)" fill="none" stroke="#22C55E" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>` +
    label("Kuma Glance", 120, 470, 104, "#FFFFFF", 800) +
    label("Your Uptime Kuma monitors at a glance", 124, 540, 38, "#94A3B8", 500) +
    label("Status · ping · uptime · tag summaries · tag folders", 124, 600, 30, "#64748B", 500) +
    keys.map((k, i) => place(k, x0 + (i % 4) * (KEY + GAP), y0 + Math.floor(i / 4) * (KEY + GAP), KEY, KEY, 22)).join("") +
    dials.map((d, i) => place(d, x0 + i * (400 + GAP), y0 + 2 * (KEY + GAP) + 30, 400, 200, 22)).join("");
  return page(body);
}

// 2. A tag folder on a Stream Deck + XL (9 × 4 keys)
function tagFolder(): string {
  const names = [
    "Nextcloud", "Home Assistant", "Jellyfin", "Paperless", "Vaultwarden", "Immich", "Gitea", "Pi-hole",
    "Grafana", "Prometheus", "Mail Server", "Traefik", "Auth Proxy", "Node-RED", "Mosquitto", "Frigate",
    "Syncthing", "Backup NAS", "Plex", "Photoprism", "Portainer", "Nginx", "Wiki.js", "Minio",
    "Audiobookshelf", "Homepage", "Authentik", "Postgres", "Redis", "Tailscale", "Unifi",
  ];
  const keys: string[] = names.map((name, i) => {
    if (name === "Mail Server" || name === "Minio") {
      return monitorKey({ name, status: "down", value: "DOWN", beats: beats("1111110000"), compact: true });
    }
    if (name === "Grafana") {
      return monitorKey({ name, status: "paused", value: "PAUSED", beats: beats("1111"), compact: true });
    }
    return monitorKey({ name, status: "up", value: String(4 + ((i * 37) % 90)), unit: "ms", beats: up, compact: true });
  });
  while (keys.length < 35) {
    keys.push(emptyKey());
  }
  keys.push(backKey());
  const KEY = 150;
  const GAP = 18;
  const x0 = (W - (9 * KEY + 8 * GAP)) / 2;
  const y0 = 250;
  const body = keys.map((k, i) => place(k, x0 + (i % 9) * (KEY + GAP), y0 + Math.floor(i / 9) * (KEY + GAP), KEY, KEY, 18)).join("");
  return page(body, "Tag folders", "Press a tag summary: one key per monitor, with paging for large tags");
}

// 3. All states side by side
function states(): string {
  const items: [string, string][] = [
    [monitorKey({ name: "Nextcloud", status: "up", value: "42", unit: "ms", caption: "avg ping 24h", beats: up }), "Up"],
    [monitorKey({ name: "Mail Server", status: "down", value: "DOWN", caption: "offline", beats: beats("111111110000") }), "Down"],
    [monitorKey({ name: "Backup NAS", status: "pending", value: "PENDING", beats: beats("111111112222") }), "Pending"],
    [monitorKey({ name: "Reverse Proxy", status: "maintenance", value: "MAINT.", beats: beats("111111113333") }), "Maintenance"],
    [monitorKey({ name: "Grafana", status: "paused", value: "PAUSED", beats: beats("1111111") }), "Paused"],
    [tagSummaryKey("Homelab", { up: 12, down: 0, other: 0, total: 12, color: "#10B981" }), "Tag: all up"],
    [tagSummaryKey("Production", { up: 7, down: 2, other: 0, total: 9, color: "#F59E0B" }), "Tag: 2 down"],
    [nextPageKey(1, 3), "Next page"],
  ];
  const KEY = 190;
  const GAP = 36;
  const x0 = (W - (4 * KEY + 3 * GAP)) / 2;
  const y0 = 250;
  const body = items
    .map(([k, text], i) => {
      const x = x0 + (i % 4) * (KEY + GAP);
      const y = y0 + Math.floor(i / 4) * (KEY + 90);
      return place(k, x, y, KEY, KEY, 22) + label(text, x + KEY / 2, y + KEY + 42, 28, "#CBD5E1", 600, "middle");
    })
    .join("");
  return page(body, "Every state at a glance", "Status color, value and the latest heartbeats on every key");
}

// 4. Dials on the touch strip
function dials(): string {
  const strip = [
    dialCanvas({ title: "Home Assistant", status: "up", value: "42", unit: "ms", caption: "avg ping 24h", beats: up }),
    dialCanvas({ title: "Nextcloud", status: "up", value: "99.95", unit: "%", caption: "uptime 24h", beats: up }),
    dialCanvas({ title: "Mail Server", status: "down", value: "DOWN", caption: "offline", beats: beats("11110000") }),
    dialCanvas({ title: "Backup NAS", status: "pending", value: "PENDING", beats: beats("11111122") }),
  ];
  const DW = 400;
  const DH = 200;
  const x0 = (W - 4 * DW) / 2;
  const y0 = 340;
  const knobs = strip
    .map((_, i) => {
      const cx = x0 + i * DW + DW / 2;
      return `<circle cx="${cx}" cy="${y0 + DH + 150}" r="70" fill="#1F2937" stroke="#374151" stroke-width="6"/><circle cx="${cx}" cy="${y0 + DH + 150}" r="46" fill="#111827"/>`;
    })
    .join("");
  const body =
    `<rect x="${x0 - 16}" y="${y0 - 16}" width="${4 * DW + 32}" height="${DH + 32}" rx="28" fill="#000000"/>` +
    `<clipPath id="strip"><rect x="${x0}" y="${y0}" width="${4 * DW}" height="${DH}" rx="16"/></clipPath>` +
    `<g clip-path="url(#strip)">${strip.map((d, i) => place(d, x0 + i * DW, y0, DW, DH, 0)).join("")}</g>` +
    knobs;
  return page(body, "Dials on Stream Deck + and + XL", "Turn to browse monitors, push to switch the value or to pause");
}

write("preview.png", overview());
write("gallery/1-overview.png", overview());
write("gallery/2-tag-folder.png", tagFolder());
write("gallery/3-states.png", states());
write("gallery/4-dials.png", dials());

// Plugin icon as PNG in common sizes (e.g. for the Marketplace listing).
const iconSvg = fs.readFileSync(path.resolve(import.meta.dirname, "..", "assets", "icon.svg"));
for (const size of [256, 288, 512, 1024]) {
  const out = path.join(docs, "icon", `icon-${size}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, new Resvg(iconSvg, { fitTo: { mode: "width", value: size } }).render().asPng());
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
