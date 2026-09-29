import streamDeck from "@elgato/streamdeck";
import { DialMonitorAction } from "./actions/dial-monitor";
import { MonitorAction } from "./actions/monitor";
import { TagBackAction, TagSlotAction } from "./actions/tag-folder";
import { TagSummaryAction } from "./actions/tag-summary";
import { kuma, type KumaSettings } from "./kuma/service";

type JsonValue = Parameters<typeof streamDeck.ui.sendToPropertyInspector>[0];

streamDeck.logger.setLevel("info");

const monitor = new MonitorAction();
const dial = new DialMonitorAction();
const tagSummary = new TagSummaryAction();
const tagSlot = new TagSlotAction();

streamDeck.actions.registerAction(monitor);
streamDeck.actions.registerAction(dial);
streamDeck.actions.registerAction(tagSummary);
streamDeck.actions.registerAction(tagSlot);
streamDeck.actions.registerAction(new TagBackAction());

// Keep every visible key and dial in sync with Uptime Kuma.

kuma.on("monitor", (id) => {
  void monitor.refresh(id);
  void dial.refresh(id);
  void tagSummary.refresh(id);
  void tagSlot.refresh();
});

function refreshAll(): void {
  void monitor.refresh();
  void dial.refresh();
  void tagSummary.refresh();
  void tagSlot.refresh();
}

kuma.on("monitors", () => {
  refreshAll();
  // Property inspectors with a hot-reloading monitor/tag list pick this up.
  sendToPropertyInspector({ event: "getMonitors", items: monitorItems() });
  sendToPropertyInspector({ event: "getTags", items: tagItems() });
});

kuma.on("state", () => {
  streamDeck.logger.info(`kuma connection: ${kuma.state}${kuma.error ? ` (${kuma.error})` : ""}`);
  refreshAll();
  sendToPropertyInspector(statusMessage());
});

// Messages from the property inspectors (ui/*.html).

type UiMessage =
  | { event: "getMonitors" | "getTags" | "getStatus" | "logout" }
  | { event: "login"; url: string; username: string; password: string; token2fa?: string };

streamDeck.ui.onSendToPlugin<UiMessage>(async (ev) => {
  const message = ev.payload;
  switch (message.event) {
    case "getMonitors":
      sendToPropertyInspector({ event: "getMonitors", items: monitorItems() });
      break;
    case "getTags":
      sendToPropertyInspector({ event: "getTags", items: tagItems() });
      break;
    case "getStatus":
      sendToPropertyInspector(statusMessage());
      break;
    case "login": {
      const url = message.url.trim().replace(/\/+$/, "");
      const result = await kuma.login(url, message.username, message.password, message.token2fa);
      if (result.ok) {
        await saveSettings({ url, token: result.token });
      }
      sendToPropertyInspector({ event: "login", ...result, token: undefined });
      break;
    }
    case "logout":
      await saveSettings({ url: kuma.settings.url });
      break;
  }
});

function monitorItems(): JsonValue {
  return kuma.monitors().map((m) => ({ label: m.name, value: m.id }));
}

function tagItems(): JsonValue {
  return kuma.tags().map((t) => ({ label: t.name, value: t.name }));
}

function statusMessage(): JsonValue {
  return {
    event: "status",
    state: kuma.state,
    url: kuma.settings.url ?? "",
    error: kuma.error ?? "",
    loggedIn: Boolean(kuma.settings.token),
    monitorCount: kuma.monitors().length,
  };
}

function sendToPropertyInspector(payload: JsonValue): void {
  if (streamDeck.ui.action) {
    streamDeck.ui.sendToPropertyInspector(payload).catch(() => undefined);
  }
}

async function saveSettings(settings: KumaSettings): Promise<void> {
  await streamDeck.settings.setGlobalSettings(settings);
  kuma.configure(settings);
  sendToPropertyInspector(statusMessage());
}

streamDeck.settings.onDidReceiveGlobalSettings<KumaSettings>((ev) => kuma.configure(ev.settings));

await streamDeck.connect();
kuma.configure(await streamDeck.settings.getGlobalSettings<KumaSettings>());
