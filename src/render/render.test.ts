import { describe, expect, it } from "vitest";
import { countByStatus, type Monitor, monitorStatus } from "../kuma/model";
import { monitorKey, tagSummaryKey } from "./keys";
import { escapeXml, wrapText } from "./svg";
import { displayValue, nextMetric } from "./values";

const monitor = (over: Partial<Monitor> = {}): Monitor => ({
  id: "1",
  name: "Nextcloud",
  active: true,
  tags: [],
  beats: [],
  heartbeat: { status: 1, ping: 41.6 },
  avgPing: 40.2,
  uptime24h: 0.99987,
  uptime30d: 0.9512,
  ...over,
});

const decode = (dataUrl: string) => Buffer.from(dataUrl.split(",")[1], "base64").toString("utf8");

describe("wrapText", () => {
  it("keeps short names on one line", () => {
    expect(wrapText("Nextcloud", 11, 2)).toEqual(["Nextcloud"]);
  });

  it("breaks after separators", () => {
    expect(wrapText("Home Assistant", 11, 2)).toEqual(["Home", "Assistant"]);
    expect(wrapText("mail.example.de", 11, 2)).toEqual(["mail.", "example.de"]);
  });

  it("ends overflowing text with an ellipsis", () => {
    expect(wrapText("mail.example-server.de", 11, 2)).toEqual(["mail.", "example-…"]);
    expect(wrapText("Grafana Dashboard Production", 11, 2)).toEqual(["Grafana", "Dashboard…"]);
  });
});

describe("monitor status and values", () => {
  it("maps Kuma heartbeat codes", () => {
    expect(monitorStatus(monitor())).toBe("up");
    expect(monitorStatus(monitor({ heartbeat: { status: 0 } }))).toBe("down");
    expect(monitorStatus(monitor({ heartbeat: { status: 2 } }))).toBe("pending");
    expect(monitorStatus(monitor({ heartbeat: { status: 3 } }))).toBe("maintenance");
    expect(monitorStatus(monitor({ heartbeat: undefined }))).toBe("unknown");
    expect(monitorStatus(monitor({ active: false }))).toBe("paused");
  });

  it("formats the selected value", () => {
    expect(displayValue(monitor(), "avgPing")).toMatchObject({ value: "40", unit: "ms" });
    expect(displayValue(monitor(), "ping")).toMatchObject({ value: "42", unit: "ms" });
    expect(displayValue(monitor(), "uptime24h")).toMatchObject({ value: "99.99", unit: "%" });
    expect(displayValue(monitor(), "uptime30d")).toMatchObject({ value: "95.1", unit: "%" });
    expect(displayValue(monitor({ uptime24h: 1 }), "uptime24h")).toMatchObject({ value: "100" });
  });

  it("shows the status instead of a value when not up", () => {
    expect(displayValue(monitor({ heartbeat: { status: 0 } }))).toMatchObject({ status: "down", value: "DOWN" });
    expect(displayValue(monitor({ active: false }))).toMatchObject({ status: "paused", value: "PAUSED" });
  });

  it("cycles through the values", () => {
    expect(nextMetric(undefined)).toBe("ping");
    expect(nextMetric("uptime30d")).toBe("avgPing");
  });
});

describe("countByStatus", () => {
  it("counts only monitors with the tag", () => {
    const tag = { name: "Service", color: "#2563EB" };
    const monitors = [
      monitor({ id: "1", tags: [tag] }),
      monitor({ id: "2", tags: [tag], heartbeat: { status: 0 } }),
      monitor({ id: "3", tags: [tag], active: false }),
      monitor({ id: "4", tags: [] }),
    ];
    expect(countByStatus(monitors, "Service")).toEqual({ up: 1, down: 1, other: 1, total: 3, color: "#2563EB" });
  });
});

describe("images", () => {
  it("escapes monitor names", () => {
    expect(escapeXml(`<a & "b">`)).toBe("&lt;a &amp; &quot;b&quot;&gt;");
    const svg = decode(monitorKey({ name: "R&D <prod>", status: "up", value: "1", beats: [] }));
    expect(svg).toContain("R&amp;D");
    expect(svg).not.toContain("<prod>");
  });

  it("draws a full ring when all monitors are up", () => {
    const svg = decode(tagSummaryKey("Service", { up: 3, down: 0, other: 0, total: 3 }));
    expect(svg).toContain("all up");
    expect(svg).not.toContain("<path");
  });
});
