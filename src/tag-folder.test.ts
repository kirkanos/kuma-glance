import { describe, expect, it } from "vitest";
import { layoutSlots, tagFolderProfile } from "./tag-folder";

const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
const summary = (slots: ReturnType<typeof layoutSlots>) =>
  slots.map((s) => (s.kind === "monitor" ? s.monitorId : s.kind === "next" ? `next ${s.page}/${s.pageCount}` : "-"));

describe("layoutSlots", () => {
  it("fills slots in order and leaves the rest empty", () => {
    expect(summary(layoutSlots(4, ids(2), 0))).toEqual(["1", "2", "-", "-"]);
  });

  it("uses every slot when the monitors fit exactly", () => {
    expect(summary(layoutSlots(3, ids(3), 0))).toEqual(["1", "2", "3"]);
  });

  it("turns the last slot into a next-page key when there are more monitors", () => {
    expect(summary(layoutSlots(3, ids(5), 0))).toEqual(["1", "2", "next 1/3"]);
    expect(summary(layoutSlots(3, ids(5), 1))).toEqual(["3", "4", "next 2/3"]);
    expect(summary(layoutSlots(3, ids(5), 2))).toEqual(["5", "-", "next 3/3"]);
  });

  it("wraps around after the last page", () => {
    expect(summary(layoutSlots(3, ids(5), 3))).toEqual(summary(layoutSlots(3, ids(5), 0)));
  });

  it("handles folders without slots or monitors", () => {
    expect(layoutSlots(0, ids(5), 0)).toEqual([]);
    expect(summary(layoutSlots(2, [], 0))).toEqual(["-", "-"]);
  });
});

describe("tagFolderProfile", () => {
  it("maps the supported device types", () => {
    expect(tagFolderProfile(0)).toBe("TagFolderStandard");
    expect(tagFolderProfile(1)).toBe("TagFolderMini");
    expect(tagFolderProfile(2)).toBe("TagFolderXL");
    expect(tagFolderProfile(7)).toBe("TagFolderPlus");
    expect(tagFolderProfile(9)).toBe("TagFolderNeo");
    expect(tagFolderProfile(12)).toBe("TagFolderGalleon");
    expect(tagFolderProfile(13)).toBe("TagFolderPlusXL");
    // No profile for devices with a user-defined layout (Mobile, Virtual).
    expect(tagFolderProfile(3)).toBeUndefined();
    expect(tagFolderProfile(11)).toBeUndefined();
  });
});
