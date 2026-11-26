import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { build } from "esbuild";

const TARGETS = {
  chrome: {
    target: "chrome123",
    outdir: "dist",
    manifest: {
      minimum_chrome_version: "123",
      background: { service_worker: "background.js" },
    },
  },
  firefox: {
    target: "firefox140",
    outdir: "dist-firefox",
    manifest: {
      background: { scripts: ["background.js"] },
      browser_specific_settings: {
        gecko: {
          id: "adhop@xavinlol",
          strict_min_version: "140.0",
          data_collection_permissions: { required: ["none"] },
        },
      },
    },
  },
};

export const BROWSERS = Object.keys(TARGETS);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function buildExtension({ browser, outdir = TARGETS[browser].outdir, minify = false }) {
  const { target, manifest: overrides } = TARGETS[browser];
  const [{ version }, base] = await Promise.all([readJson("package.json"), readJson("static/manifest.json")]);
  const manifest = { ...base, version, ...overrides };

  await rm(outdir, { recursive: true, force: true });
  await cp("static", outdir, { recursive: true });
  await writeFile(join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await build({
    entryPoints: ["src/background.ts", "src/content.ts", "src/page.ts", "src/popup.ts", "src/options.ts"],
    outdir,
    bundle: true,
    minify,
    format: "iife",
    target,
  });
}

if (import.meta.main) {
  const { browser, minify } = parseArgs({
    options: {
      browser: { type: "string", default: "chrome" },
      minify: { type: "boolean", default: false },
    },
  }).values;
  if (!BROWSERS.includes(browser)) {
    throw new Error(`Unknown browser "${browser}", expected one of ${BROWSERS.join(", ")}`);
  }
  await buildExtension({ browser, minify });
}
