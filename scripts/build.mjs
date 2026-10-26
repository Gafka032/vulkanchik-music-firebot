import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const outFile = path.join(distDir, "vulkanchik-music.js");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(pkg.version || "0.0.0");
const minFirebot = String(pkg.vulkanchik?.minFirebot || "5.67.0");
const notesUk = String(pkg.vulkanchik?.releaseNotesUk || "").trim();

/** Optional: monorepo `frontend/public/downloads/firebot` (or any ship dir). */
const shipDir = (process.env.VULKANCHIK_DOWNLOADS_DIR || "").trim();
/** Optional: monorepo `frontend/src/content/guides` for in-app ?raw docs. */
const guideDir = (process.env.VULKANCHIK_GUIDES_DIR || "").trim();

fs.mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: outFile,
  external: ["@crowbartools/firebot-types"],
  sourcemap: false,
  minify: false,
  logLevel: "info",
  define: {
    __PLUGIN_VERSION__: JSON.stringify(version),
  },
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

const readmeSrc = path.join(root, "README.md");
const updatedAt = new Date().toISOString().slice(0, 10);
const manifest = {
  name: "Vulkanchik Music",
  version,
  updatedAt,
  downloadPath: "/downloads/firebot/vulkanchik-music.js",
  minFirebot,
  notesUk,
  sourceRepo: "https://github.com/Gafka032/vulkanchik-music-firebot",
};
fs.writeFileSync(
  path.join(distDir, "plugin-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);
fs.copyFileSync(readmeSrc, path.join(distDir, "README.md"));

function shipTo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(outFile, path.join(dir, "vulkanchik-music.js"));
  fs.copyFileSync(readmeSrc, path.join(dir, "README.md"));
  fs.copyFileSync(
    path.join(distDir, "plugin-manifest.json"),
    path.join(dir, "plugin-manifest.json")
  );
  fs.rmSync(path.join(dir, "vulkanchik-music-firebot.zip"), { force: true });
  console.log(`Shipped → ${dir}`);
}

if (shipDir) shipTo(shipDir);

if (guideDir) {
  fs.mkdirSync(guideDir, { recursive: true });
  fs.copyFileSync(readmeSrc, path.join(guideDir, "firebot-README.md"));
  console.log(`Guide → ${path.join(guideDir, "firebot-README.md")}`);
}

console.log(`Built ${outFile} (v${version})`);
console.log(`Manifest ${path.join(distDir, "plugin-manifest.json")}`);
