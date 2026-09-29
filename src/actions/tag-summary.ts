import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { PLUGIN_ID } from "../config";
import { countByStatus } from "../kuma/model";
import { kuma } from "../kuma/service";
import { messageKey, tagSummaryKey } from "../render/keys";
import { openFolders, tagFolderProfile } from "../tag-folder";
import { showImage, updates } from "../throttle";

export type TagSummarySettings = { tag?: string };

/** Up/down summary of all monitors with a tag; pressing it opens the tag folder. */
@action({ UUID: `${PLUGIN_ID}.tag-summary` })
export class TagSummaryAction extends SingletonAction<TagSummarySettings> {
  readonly #settings = new Map<string, TagSummarySettings>();

  override onWillAppear(ev: WillAppearEvent<TagSummarySettings>): Promise<void> {
    this.#settings.set(ev.action.id, ev.payload.settings);
    return this.#render(ev.action.id);
  }

  override onWillDisappear(ev: WillDisappearEvent<TagSummarySettings>): void {
    this.#settings.delete(ev.action.id);
    updates.forget(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<TagSummarySettings>): Promise<void> {
    this.#settings.set(ev.action.id, ev.payload.settings);
    return this.#render(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<TagSummarySettings>): Promise<void> {
    const tag = ev.payload.settings.tag;
    const device = ev.action.device;
    const profile = tagFolderProfile(device.type);

    streamDeck.logger.info(`tag-summary pressed: tag=${tag} device=${device.id} type=${device.type} profile=${profile}`);

    if (!tag || !profile || !ev.action.isKey()) {
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
      return;
    }

    openFolders.set(device.id, { tag, page: 0 });
    await streamDeck.profiles.switchToProfile(device.id, profile);
  }

  /** Re-renders every summary whose tag is carried by `monitorId` (or all). */
  async refresh(monitorId?: string): Promise<void> {
    const tags = monitorId === undefined ? undefined : kuma.monitor(monitorId)?.tags.map((t) => t.name);
    for (const [id, settings] of this.#settings) {
      if (tags === undefined || (settings.tag && tags.includes(settings.tag))) {
        await this.#render(id);
      }
    }
  }

  async #render(actionId: string): Promise<void> {
    const key = this.actions.find((a) => a.id === actionId);
    const tag = this.#settings.get(actionId)?.tag;
    if (!key?.isKey()) {
      return;
    }

    if (kuma.state === "unconfigured") {
      showImage(key, messageKey("Log in", "see settings"));
    } else if (!tag) {
      showImage(key, messageKey("Select", "a tag"));
    } else if (!kuma.isConnected) {
      showImage(key, messageKey("Offline", kuma.state === "error" ? "check login" : "connecting…"));
    } else {
      showImage(key, tagSummaryKey(tag, countByStatus(kuma.monitors(), tag)));
    }
  }
}
