import {
  action,
  type DialAction,
  type DialDownEvent,
  type DialRotateEvent,
  type DidReceiveSettingsEvent,
  SingletonAction,
  type TouchTapEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { PLUGIN_ID } from "../config";
import { kuma } from "../kuma/service";
import { dialCanvas, dialMessage } from "../render/dial";
import { displayValue, nextMetric } from "../render/values";
import type { MonitorSettings } from "./monitor";

/** A dial browsing through all monitors; the touch strip shows the selected one. */
@action({ UUID: `${PLUGIN_ID}.dial-monitor` })
export class DialMonitorAction extends SingletonAction<MonitorSettings> {
  readonly #settings = new Map<string, MonitorSettings>();

  override onWillAppear(ev: WillAppearEvent<MonitorSettings>): Promise<void> {
    this.#settings.set(ev.action.id, ev.payload.settings);
    return this.#render(ev.action.id);
  }

  override onWillDisappear(ev: WillDisappearEvent<MonitorSettings>): void {
    this.#settings.delete(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<MonitorSettings>): Promise<void> {
    this.#settings.set(ev.action.id, ev.payload.settings);
    return this.#render(ev.action.id);
  }

  override async onDialRotate(ev: DialRotateEvent<MonitorSettings>): Promise<void> {
    const monitors = kuma.monitors();
    if (monitors.length === 0) {
      return;
    }
    const settings = { ...ev.payload.settings };
    const current = monitors.findIndex((m) => m.id === settings.monitorId);
    const next = (((current < 0 ? 0 : current + Math.sign(ev.payload.ticks)) % monitors.length) + monitors.length) % monitors.length;
    settings.monitorId = monitors[next].id;
    await this.#save(ev.action, settings);
  }

  override onDialDown(ev: DialDownEvent<MonitorSettings>): Promise<void> {
    return this.#press(ev.action, ev.payload.settings);
  }

  override onTouchTap(ev: TouchTapEvent<MonitorSettings>): Promise<void> {
    return this.#press(ev.action, ev.payload.settings);
  }

  async refresh(monitorId?: string): Promise<void> {
    for (const [id, settings] of this.#settings) {
      if (monitorId === undefined || settings.monitorId === monitorId) {
        await this.#render(id);
      }
    }
  }

  async #press(dial: DialAction<MonitorSettings>, current: MonitorSettings): Promise<void> {
    const settings = { ...current };
    if (settings.action === "togglePause") {
      const monitor = kuma.monitor(settings.monitorId);
      if (!monitor || !(await kuma.setPaused(monitor.id, monitor.active))) {
        await dial.showAlert();
      }
      return;
    }
    settings.metric = nextMetric(settings.metric);
    await this.#save(dial, settings);
  }

  async #save(dial: DialAction<MonitorSettings>, settings: MonitorSettings): Promise<void> {
    this.#settings.set(dial.id, settings);
    await dial.setSettings(settings);
    await this.#render(dial.id);
  }

  async #render(actionId: string): Promise<void> {
    const dial = this.actions.find((a) => a.id === actionId);
    const settings = this.#settings.get(actionId);
    if (!dial?.isDial() || !settings) {
      return;
    }

    const monitor = kuma.monitor(settings.monitorId);
    let canvas: string;
    if (kuma.state === "unconfigured") {
      canvas = dialMessage("Log in", "open the dial settings");
    } else if (!kuma.isConnected) {
      canvas = dialMessage("Offline", kuma.state === "error" ? "check login" : "connecting…");
    } else if (!monitor) {
      canvas = dialMessage("Turn to select", `${kuma.monitors().length} monitors`);
    } else {
      canvas = dialCanvas({ title: monitor.name, ...displayValue(monitor, settings.metric), beats: monitor.beats });
    }
    await dial.setFeedback({ canvas });
  }
}
