import { cp, rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import { build } from "esbuild";

const { outdir, minify } = parseArgs({
  options: {
    outdir: { type: "string", default: "dist" },
    minify: { type: "boolean", default: false },
  },
}).values;

await rm(outdir, { recursive: true, force: true });
await cp("static", outdir, { recursive: true });
await build({
  entryPoints: ["src/background.ts", "src/content.ts", "src/page.ts", "src/popup.ts", "src/options.ts"],
  outdir,
  bundle: true,
  minify,
  format: "iife",
  target: "chrome123",
});
