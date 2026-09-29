import type { DeviceType } from "@elgato/streamdeck";
import TAG_FOLDERS from "./tag-folders.json";

/** Bundled read-only profile acting as the tag folder for a device type. */
export function tagFolderProfile(deviceType: DeviceType | number): string | undefined {
  return TAG_FOLDERS.find((f) => f.deviceType === deviceType)?.profile;
}

export type SlotContent =
  | { kind: "monitor"; monitorId: string }
  | { kind: "next"; page: number; pageCount: number }
  | { kind: "empty" };

/**
 * Distributes the monitors of a tag over the slots of an open folder
 * (slots ordered top-left to bottom-right). With more monitors than slots,
 * the last slot becomes a "next page" key and `page` wraps around.
 */
export function layoutSlots(slotCount: number, monitorIds: string[], page: number): SlotContent[] {
  const paged = slotCount > 1 && monitorIds.length > slotCount;
  const perPage = Math.max(1, paged ? slotCount - 1 : slotCount);
  const pageCount = Math.max(1, Math.ceil(monitorIds.length / perPage));
  const current = ((page % pageCount) + pageCount) % pageCount;

  return Array.from({ length: slotCount }, (_, index): SlotContent => {
    if (paged && index === slotCount - 1) {
      return { kind: "next", page: current + 1, pageCount };
    }
    const monitorId = monitorIds[current * perPage + index];
    return monitorId ? { kind: "monitor", monitorId } : { kind: "empty" };
  });
}

/** Tag and page of the folder currently open on each device. */
export const openFolders = new Map<string, { tag: string; page: number }>();
