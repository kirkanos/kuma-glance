import streamDeck, {
  action,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { PLUGIN_ID } from "../config";
import { kuma } from "../kuma/service";
import { backKey, emptyKey, monitorKey, nextPageKey } from "../render/keys";
import { displayValue } from "../render/values";
import { layoutSlots, openFolders, type SlotContent } from "../tag-folder";
import { showImage, updates } from "../throttle";
import { unavailableImage } from "./monitor";

/**
 * A monitor slot inside a tag folder (bundled read-only profile). The slots
 * are filled top-left to bottom-right with the monitors of the tag whose
 * summary key opened the folder; pressing a slot opens the monitor in Uptime
 * Kuma, the "next" slot pages through the monitors.
 */
@action({ UUID: `${PLUGIN_ID}.tag-slot` })
export class TagSlotAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    if (ev.action.isKey()) {
      await ev.action.setTitle("");
    }
    await this.refresh(ev.action.device.id);
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    updates.forget(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const deviceId = ev.action.device.id;
    const content = this.#layout(deviceId).get(ev.action.id);

    if (content?.kind === "next") {
      const folder = openFolders.get(deviceId);
      if (folder) {
        // content.page is the current page counted from 1, i.e. the next page counted from 0.
        folder.page = content.page;
      }
      await this.refresh(deviceId);
      return;
    }

    const url = kuma.settings.url;
    if (content?.kind === "monitor" && url) {
      await streamDeck.system.openUrl(`${url.replace(/\/+$/, "")}/dashboard/${content.monitorId}`);
    } else {
      await ev.action.showAlert();
    }
  }

  /** Re-renders the slots of one device, or of all devices with an open folder. */
  async refresh(deviceId?: string): Promise<void> {
    const devices = deviceId ? [deviceId] : [...new Set(this.#slots().map((s) => s.device.id))];
    for (const id of devices) {
      for (const [actionId, content] of this.#layout(id)) {
        const slot = this.#slots().find((s) => s.id === actionId);
        if (slot) {
          await render(slot, content);
        }
      }
    }
  }

  #slots(): KeyAction<JsonObject>[] {
    return this.actions.filter((a) => a.isKey()).toArray() as KeyAction<JsonObject>[];
  }

  /** Slot contents of a device, keyed by action id. */
  #layout(deviceId: string): Map<string, SlotContent> {
    const slots = this.#slots()
      .filter((s) => s.device.id === deviceId)
      .sort((a, b) => (a.coordinates?.row ?? 0) - (b.coordinates?.row ?? 0) || (a.coordinates?.column ?? 0) - (b.coordinates?.column ?? 0));
    const folder = openFolders.get(deviceId);
    const monitorIds = folder ? kuma.monitorsWithTag(folder.tag).map((m) => m.id) : [];
    const contents = layoutSlots(slots.length, monitorIds, folder?.page ?? 0);
    return new Map(slots.map((slot, i) => [slot.id, contents[i]]));
  }
}

async function render(slot: KeyAction<JsonObject>, content: SlotContent): Promise<void> {
  if (content.kind === "next") {
    showImage(slot, nextPageKey(content.page, content.pageCount));
    return;
  }
  if (content.kind === "empty") {
    showImage(slot, emptyKey());
    return;
  }

  const unavailable = unavailableImage(content.monitorId);
  const monitor = kuma.monitor(content.monitorId);
  if (unavailable || !monitor) {
    showImage(slot, unavailable);
    return;
  }
  const { caption: _caption, ...value } = displayValue(monitor, "ping");
  showImage(slot, monitorKey({ name: monitor.name, ...value, beats: monitor.beats, compact: true }));
}

/** Back key inside a tag folder: returns to the previous profile. */
@action({ UUID: `${PLUGIN_ID}.tag-back` })
export class TagBackAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    if (ev.action.isKey()) {
      await ev.action.setTitle("");
      await ev.action.setImage(backKey());
    }
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    openFolders.delete(ev.action.device.id);
    await streamDeck.profiles.switchToProfile(ev.action.device.id);
  }
}
