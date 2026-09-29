import {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type TitleParametersDidChangeEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { PLUGIN_ID } from "../config";
import { kuma } from "../kuma/service";
import { messageKey, monitorKey } from "../render/keys";
import { displayValue, type Metric, nextMetric } from "../render/values";

export type MonitorSettings = {
  monitorId?: string;
  metric?: Metric;
  action?: "nextMetric" | "togglePause";
};

/** Image for keys that cannot show a monitor (not logged in, offline, nothing selected). */
export function unavailableImage(monitorId: string | undefined): string | undefined {
  if (kuma.state === "unconfigured") {
    return messageKey("Log in", "see settings");
  }
  if (!monitorId) {
    return messageKey("Select", "a monitor");
  }
  if (!kuma.isConnected) {
    return messageKey("Offline", kuma.state === "error" ? "check login" : "connecting…");
  }
  if (!kuma.monitor(monitorId)) {
    return messageKey("Unknown", "monitor");
  }
  return undefined;
}

/** A key showing one monitor; pressing it cycles the value or pauses/resumes. */
@action({ UUID: `${PLUGIN_ID}.monitor` })
export class MonitorAction extends SingletonAction<MonitorSettings> {
  readonly #settings = new Map<string, MonitorSettings>();
  /** Keys with a user-defined title: the name is not drawn into the image then. */
  readonly #hasTitle = new Map<string, boolean>();

  override onWillAppear(ev: WillAppearEvent<MonitorSettings>): Promise<void> {
    this.#settings.set(ev.action.id, ev.payload.settings);
    return this.#render(ev.action.id);
  }

  override onWillDisappear(ev: WillDisappearEvent<MonitorSettings>): void {
    this.#settings.delete(ev.action.id);
    this.#hasTitle.delete(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<MonitorSettings>): Promise<void> {
    this.#settings.set(ev.action.id, ev.payload.settings);
    return this.#render(ev.action.id);
  }

  override onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<MonitorSettings>): Promise<void> {
    this.#hasTitle.set(ev.action.id, ev.payload.title.trim() !== "");
    return this.#render(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<MonitorSettings>): Promise<void> {
    const settings = { ...ev.payload.settings };
    const monitor = kuma.monitor(settings.monitorId);

    if (settings.action === "togglePause") {
      const ok = monitor ? await kuma.setPaused(monitor.id, monitor.active) : false;
      await (ok ? ev.action.showOk() : ev.action.showAlert());
      return;
    }

    settings.metric = nextMetric(settings.metric);
    this.#settings.set(ev.action.id, settings);
    await ev.action.setSettings(settings);
    await this.#render(ev.action.id);
  }

  /** Re-renders all visible keys, or only those showing `monitorId`. */
  async refresh(monitorId?: string): Promise<void> {
    for (const [id, settings] of this.#settings) {
      if (monitorId === undefined || settings.monitorId === monitorId) {
        await this.#render(id);
      }
    }
  }

  async #render(actionId: string): Promise<void> {
    const key = this.actions.find((a) => a.id === actionId) as KeyAction<MonitorSettings> | undefined;
    const settings = this.#settings.get(actionId);
    if (!key || !settings) {
      return;
    }

    const unavailable = unavailableImage(settings.monitorId);
    const monitor = kuma.monitor(settings.monitorId);
    if (unavailable || !monitor) {
      await key.setImage(unavailable);
      return;
    }

    await key.setImage(
      monitorKey({
        name: this.#hasTitle.get(actionId) ? undefined : monitor.name,
        ...displayValue(monitor, settings.metric),
        beats: monitor.beats,
      }),
    );
  }
}
