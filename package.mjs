import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";
import { BROWSERS, buildExtension } from "./build.mjs";

async function zipDirectory(source, target) {
  const files = {};
  for (const entry of await readdir(source, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      files[relative(source, path).replaceAll(sep, "/")] = await readFile(path);
    }
  }
  await writeFile(target, zipSync(files, { level: 9 }));
}

const { name, version } = JSON.parse(await readFile("package.json", "utf8"));
for (const browser of BROWSERS) {
  const outdir = `release/${browser}`;
  await buildExtension({ browser, outdir, minify: true });
  const target = `release/${name}-${version}-${browser}.zip`;
  await zipDirectory(outdir, target);
  console.log(target);
}
