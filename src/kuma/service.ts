import { EventEmitter } from "node:events";
import { io, type Socket } from "socket.io-client";
import { byName, type Heartbeat, MAX_BEATS, type Monitor, type Tag } from "./model";

export type KumaSettings = { url?: string; token?: string };

export type ConnectionState = "unconfigured" | "connecting" | "connected" | "error";

export type LoginResult = { ok: true; token: string } | { ok: false; needs2fa?: boolean; error: string };

type RawMonitor = {
  id: number | string;
  name: string;
  active: boolean | number;
  tags?: { name: string; color?: string }[];
};

type Ack = { ok: boolean; msg?: string; msgi18n?: boolean; token?: string; tokenRequired?: boolean };

// Kuma answers with i18n keys for these errors.
const MESSAGES: Record<string, string> = {
  authIncorrectCreds: "Wrong username or password",
  authInvalidToken: "Login expired, please log in again",
  authUserInactiveOrDeleted: "User is inactive or deleted",
};

const errorText = (ack: Ack, fallback: string) => (ack.msg && MESSAGES[ack.msg]) || ack.msg || fallback;

const TIMEOUT_MS = 15_000;

/**
 * Keeps one authenticated socket.io connection to Uptime Kuma and the live
 * state of all monitors.
 *
 * Events:
 *   "monitor" (id)  a single monitor changed (heartbeat, ping, uptime)
 *   "monitors"      the monitor list changed (added/removed/renamed/tags)
 *   "state"         the connection state changed
 */
export class KumaService extends EventEmitter<{ monitor: [string]; monitors: []; state: [] }> {
  #settings: KumaSettings = {};
  #socket: Socket | undefined;
  #state: ConnectionState = "unconfigured";
  #error: string | undefined;
  readonly #monitors = new Map<string, Monitor>();

  get settings(): KumaSettings {
    return this.#settings;
  }

  get state(): ConnectionState {
    return this.#state;
  }

  get error(): string | undefined {
    return this.#error;
  }

  get isConnected(): boolean {
    return this.#state === "connected";
  }

  monitor(id: string | number | undefined): Monitor | undefined {
    return id === undefined ? undefined : this.#monitors.get(String(id));
  }

  /** All monitors, sorted by name. */
  monitors(): Monitor[] {
    return [...this.#monitors.values()].sort(byName);
  }

  /** Monitors carrying the tag, sorted by name. */
  monitorsWithTag(tagName: string): Monitor[] {
    return this.monitors().filter((m) => m.tags.some((t) => t.name === tagName));
  }

  /** All tags in use, sorted by name. */
  tags(): Tag[] {
    const tags = new Map<string, Tag>();
    for (const monitor of this.#monitors.values()) {
      for (const tag of monitor.tags) {
        if (!tags.has(tag.name)) {
          tags.set(tag.name, tag);
        }
      }
    }
    return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Applies new connection settings; reconnects only when they changed. */
  configure(settings: KumaSettings): void {
    if (settings.url === this.#settings.url && settings.token === this.#settings.token && this.#socket) {
      return;
    }
    this.#settings = { url: settings.url, token: settings.token };
    this.#disconnect();
    this.#monitors.clear();
    this.emit("monitors");

    if (settings.url && settings.token) {
      this.#connect(settings.url, settings.token);
    } else {
      this.#setState("unconfigured");
    }
  }

  /** Logs in with username/password (and 2FA code) using a temporary connection. */
  async login(url: string, username: string, password: string, token2fa?: string): Promise<LoginResult> {
    const socket = io(url, { reconnection: false, timeout: TIMEOUT_MS });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", (err) => reject(err));
      });
      const ack = await emitWithAck(socket, "login", { username, password, token: token2fa || undefined });
      if (ack.ok && ack.token) {
        return { ok: true, token: ack.token };
      }
      if (ack.tokenRequired) {
        return { ok: false, needs2fa: true, error: "Two-factor code required" };
      }
      return { ok: false, error: errorText(ack, "Login failed") };
    } catch (err) {
      return { ok: false, error: `Cannot reach ${url}: ${(err as Error).message}` };
    } finally {
      socket.disconnect();
    }
  }

  async setPaused(monitorId: string, paused: boolean): Promise<boolean> {
    if (!this.#socket || !this.isConnected) {
      return false;
    }
    try {
      const ack = await emitWithAck(this.#socket, paused ? "pauseMonitor" : "resumeMonitor", Number(monitorId));
      const monitor = this.monitor(monitorId);
      if (ack.ok && monitor) {
        // Show the change right away; Kuma confirms it with a list update.
        monitor.active = !paused;
        this.emit("monitor", monitor.id);
      }
      return ack.ok;
    } catch {
      return false;
    }
  }

  #connect(url: string, token: string): void {
    this.#setState("connecting");
    const socket = io(url, { reconnection: true, reconnectionDelayMax: 30_000 });
    this.#socket = socket;

    // (Re)authenticate after every (re)connect.
    socket.on("connect", async () => {
      try {
        const ack = await emitWithAck(socket, "loginByToken", token);
        if (ack.ok) {
          this.#setState("connected");
        } else {
          this.#setState("error", errorText(ack, "Authentication failed"));
        }
      } catch (err) {
        this.#setState("error", (err as Error).message);
      }
    });
    socket.on("disconnect", () => this.#setState("connecting"));
    socket.on("connect_error", (err) => this.#setState("error", `Connection error: ${err.message}`));

    // Kuma 1.x sends the full list on every change; Kuma 2.x sends it once and
    // then only the changed / deleted monitors.
    socket.on("monitorList", (list: Record<string, RawMonitor>) => this.#updateMonitors(list, true));
    socket.on("updateMonitorIntoList", (list: Record<string, RawMonitor>) => this.#updateMonitors(list, false));
    socket.on("deleteMonitorFromList", (monitorID: number) => {
      if (this.#monitors.delete(String(monitorID))) {
        this.emit("monitors");
      }
    });

    socket.on("heartbeat", (beat: Heartbeat & { monitorID: number }) => {
      const monitor = this.monitor(beat.monitorID);
      if (monitor) {
        monitor.heartbeat = beat;
        monitor.beats = [...monitor.beats, beat].slice(-MAX_BEATS);
        this.emit("monitor", monitor.id);
      }
    });

    socket.on("heartbeatList", (monitorID: number, list: Heartbeat[]) => {
      const monitor = this.monitor(monitorID);
      if (monitor && Array.isArray(list)) {
        monitor.beats = list.slice(-MAX_BEATS);
        monitor.heartbeat = list.at(-1) ?? monitor.heartbeat;
        this.emit("monitor", monitor.id);
      }
    });

    socket.on("avgPing", (monitorID: number, avgPing: number | null) => {
      const monitor = this.monitor(monitorID);
      if (monitor) {
        monitor.avgPing = avgPing ?? undefined;
        this.emit("monitor", monitor.id);
      }
    });

    socket.on("uptime", (monitorID: number, period: number | string, percent: number) => {
      const monitor = this.monitor(monitorID);
      if (monitor) {
        if (Number(period) === 24) {
          monitor.uptime24h = percent;
        } else if (Number(period) === 720) {
          monitor.uptime30d = percent;
        }
        this.emit("monitor", monitor.id);
      }
    });
  }

  #updateMonitors(list: Record<string, RawMonitor>, isFullList: boolean): void {
    const present = new Set<string>();
    for (const raw of Object.values(list)) {
      const id = String(raw.id);
      present.add(id);
      const tags = (raw.tags ?? []).map((t) => ({ name: t.name, color: t.color }));
      const existing = this.#monitors.get(id);
      if (existing) {
        existing.name = raw.name;
        existing.active = Boolean(raw.active);
        existing.tags = tags;
      } else {
        this.#monitors.set(id, { id, name: raw.name, active: Boolean(raw.active), tags, beats: [] });
      }
    }
    // A full list also tells which monitors were deleted in Uptime Kuma.
    if (isFullList) {
      for (const id of this.#monitors.keys()) {
        if (!present.has(id)) {
          this.#monitors.delete(id);
        }
      }
    }
    this.emit("monitors");
  }

  #disconnect(): void {
    this.#socket?.removeAllListeners();
    this.#socket?.disconnect();
    this.#socket = undefined;
  }

  #setState(state: ConnectionState, error?: string): void {
    if (state === this.#state && error === this.#error) {
      return;
    }
    this.#state = state;
    this.#error = error;
    this.emit("state");
  }
}

function emitWithAck(socket: Socket, event: string, ...args: unknown[]): Promise<Ack> {
  return socket.timeout(TIMEOUT_MS).emitWithAck(event, ...args) as Promise<Ack>;
}

export const kuma = new KumaService();
