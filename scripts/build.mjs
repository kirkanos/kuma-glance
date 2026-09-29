/**
 * Builds the plugin folder dist/<pluginId>.sdPlugin:
 *   1. copies the static files from plugin/ (images, ui, layouts, manifest)
 *      and renders the plugin icon (assets/icon.svg) to PNG
 *   2. bundles src/plugin.ts into bin/plugin.js (rollup)
 *   3. generates the tag-folder profiles and registers them in the manifest
 *
 * Usage: node scripts/build.mjs [--dev] [--watch]
 *   --dev    builds the parallel-installable variant
 *            (id com.kirkanos.kuma-glance-dev, name "Kuma Glance (dev)")
 *   --watch  rebuilds on changes and restarts the plugin in Stream Deck
 *            (the dev folder must be linked once: npm run link:dev)
 *
 * The manifest version is taken from package.json (<version>.0), or from the
 * PLUGIN_VERSION environment variable (used by CI for tag builds).
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { rollup, watch } from "rollup";
import { createRollupConfig } from "../rollup.config.mjs";
import { generateProfiles } from "./gen-profiles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const isDev = args.has("--dev");
const isWatch = args.has("--watch");

const BASE_ID = "com.kirkanos.kuma-glance";
const BASE_NAME = "Kuma Glance";
const pluginId = isDev ? `${BASE_ID}-dev` : BASE_ID;
const pluginName = isDev ? `${BASE_NAME} (dev)` : BASE_NAME;
const outDir = path.join(root, "dist", `${pluginId}.sdPlugin`);

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const pkg = readJson(path.join(root, "package.json"));
const tagFolders = readJson(path.join(root, "src", "tag-folders.json"));

function manifestVersion() {
  const version = process.env.PLUGIN_VERSION || pkg.version;
  const parts = version.split(".");
  while (parts.length < 4) {
    parts.push("0");
  }
  return parts.slice(0, 4).join(".");
}

function writeStaticFiles() {
  // Empty the folder but keep it (Stream Deck links to it) and its logs.
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of fs.readdirSync(outDir)) {
    if (entry !== "logs") {
      fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
    }
  }
  fs.cpSync(path.join(root, "plugin"), outDir, {
    recursive: true,
    filter: (src) => path.basename(src) !== ".DS_Store",
  });

  // The plugin icon must be a PNG (256 px, 512 px for high DPI).
  const iconSvg = fs.readFileSync(path.join(root, "assets", "icon.svg"));
  for (const [file, size] of [["icon.png", 256], ["icon@2x.png", 512]]) {
    const png = new Resvg(iconSvg, { fitTo: { mode: "width", value: size } }).render().asPng();
    fs.writeFileSync(path.join(outDir, "images", file), png);
  }

  const manifestPath = path.join(outDir, "manifest.json");
  const manifest = readJson(manifestPath);

  manifest.UUID = pluginId;
  manifest.Name = pluginName;
  manifest.Category = pluginName;
  manifest.Version = manifestVersion();
  for (const action of manifest.Actions) {
    action.UUID = action.UUID.replace(BASE_ID, pluginId);
  }
  manifest.Profiles = generateProfiles(pluginId, tagFolders, outDir, outDir);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote ${path.relative(root, outDir)} (${pluginId} ${manifest.Version})`);
}

function restartPlugin() {
  execFile("npx", ["streamdeck", "restart", pluginId], (err, stdout, stderr) => {
    process.stdout.write(stdout);
    if (err) {
      process.stderr.write(stderr);
    }
  });
}

writeStaticFiles();

const config = createRollupConfig({ pluginId, outDir, isWatching: isWatch });

if (isWatch) {
  const watcher = watch(config);
  watcher.on("event", (event) => {
    if (event.code === "BUNDLE_END") {
      event.result.close();
      console.log(`bundled bin/plugin.js in ${event.duration}ms`);
      restartPlugin();
    } else if (event.code === "ERROR") {
      console.error(event.error);
    }
  });
} else {
  const bundle = await rollup(config);
  await bundle.write(config.output);
  await bundle.close();
  console.log("bundled bin/plugin.js");
}
