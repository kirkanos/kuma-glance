/**
 * Generates the bundled "tag folder" profiles as .streamDeckProfile archives.
 *
 * The supported devices are listed in src/tag-folders.json (shared with the
 * plugin, which uses it to pick the profile for the pressed device). Adding a
 * device = adding one entry there.
 *
 * Two archive formats are produced, both verified against Elgato's own
 * bundled profiles:
 *   format 2: ZIP with a single "<UUID>.sdProfile/" folder whose manifest.json
 *             uses the flat "Actions" map (keys are "column,row").
 *   format 3: ZIP with package.json + "Profiles/<UUID>.sdProfile/" containing
 *             a profile manifest (Version 3.0) and one folder per page, each
 *             page manifest holding "Controllers" (Keypad / Encoder).
 *
 * Every grid is filled with tag-slot actions plus a single tag-back action in
 * the bottom-right cell.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const uuid = () => crypto.randomUUID().toUpperCase();

function keyState(alignment) {
  return {
    FFamily: "",
    FSize: "",
    FStyle: "",
    FUnderline: "",
    Image: "", // empty -> use the action's default icon; plugin overrides at runtime
    Title: "",
    TitleAlignment: alignment,
    TitleColor: "",
    TitleShow: "",
  };
}

// Key grid shared by both formats: slots everywhere, back in the bottom-right.
function buildKeys(pluginId, p) {
  const keys = {};
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.columns; c++) {
      const isBack = c === p.columns - 1 && r === p.rows - 1;
      keys[`${c},${r}`] = {
        Name: isBack ? "Back" : "Tag Slot",
        Settings: null,
        State: 0,
        States: [keyState(isBack ? "middle" : "top")],
        UUID: isBack ? `${pluginId}.tag-back` : `${pluginId}.tag-slot`,
      };
    }
  }
  return keys;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

function writeFormat2(root, pluginId, p, keys) {
  const profileDir = path.join(root, `${uuid()}.sdProfile`);
  writeJson(path.join(profileDir, "manifest.json"), {
    Actions: keys,
    DeviceModel: p.model,
    InstalledByPluginUUID: pluginId,
    Name: "Kuma Glance Tag Folder",
    PreconfiguredName: "Kuma Glance Tag Folder",
    Version: "1.0",
  });
  // Create an (empty) folder per key coordinate, mirroring exported profiles.
  for (const coord of Object.keys(keys)) {
    fs.mkdirSync(path.join(profileDir, coord), { recursive: true });
  }
}

function writeFormat3(root, pluginId, p, keys) {
  writeJson(path.join(root, "package.json"), {
    AppVersion: "7.3.1.22604",
    DeviceModel: p.model,
    DeviceSettings: null,
    FormatVersion: 1,
    OSType: "macOS",
    OSVersion: "",
    RequiredPlugins: [pluginId],
  });

  const profileDir = path.join(root, "Profiles", `${uuid()}.sdProfile`);
  const defaultPage = uuid();
  const slotPage = uuid();

  writeJson(path.join(profileDir, "manifest.json"), {
    Device: { Model: p.model, UUID: "" },
    Name: "Kuma Glance Tag Folder",
    Pages: {
      Current: "00000000-0000-0000-0000-000000000000",
      Default: defaultPage.toLowerCase(),
      Pages: [slotPage.toLowerCase()],
    },
    Version: "3.0",
  });

  const controllers = (keypadActions) => {
    const list = [{ Actions: keypadActions, Type: "Keypad" }];
    if (p.encoders) {
      list.push({ Actions: null, Type: "Encoder" });
    }
    return list;
  };

  writeJson(path.join(profileDir, "Profiles", defaultPage, "manifest.json"), {
    Controllers: controllers(null),
    Icon: "",
    Name: "",
  });
  writeJson(path.join(profileDir, "Profiles", slotPage, "manifest.json"), {
    Controllers: controllers(keys),
    Icon: "",
    Name: "",
  });
  for (const page of [defaultPage, slotPage]) {
    fs.mkdirSync(path.join(profileDir, "Profiles", page, "Images"), {
      recursive: true,
    });
  }
}

/**
 * Writes one "<profile>.streamDeckProfile" per entry of `tagFolders` into
 * `outDir` and returns the matching manifest "Profiles" entries.
 */
export function generateProfiles(pluginId, tagFolders, outDir, manifestDir) {
  fs.mkdirSync(outDir, { recursive: true });

  return tagFolders.map((p) => {
    const keys = buildKeys(pluginId, p);
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sdprofile-"));

    if (p.format === 3) {
      writeFormat3(tmpRoot, pluginId, p, keys);
    } else {
      writeFormat2(tmpRoot, pluginId, p, keys);
    }

    const zipPath = path.resolve(outDir, `${p.profile}.streamDeckProfile`);
    fs.rmSync(zipPath, { force: true });
    execFileSync("zip", ["-r", "-q", "-X", zipPath, "."], { cwd: tmpRoot });
    fs.rmSync(tmpRoot, { recursive: true, force: true });

    // Manifest paths are relative to the plugin folder, without extension.
    const name = path
      .relative(manifestDir, zipPath)
      .replace(/\.streamDeckProfile$/, "")
      .split(path.sep)
      .join("/");

    return {
      Name: name,
      DeviceType: p.deviceType,
      Readonly: true,
      DontAutoSwitchWhenInstalled: true,
    };
  });
}
