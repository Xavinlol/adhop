import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";

const source = "release/extension";
const files = {};
for (const entry of await readdir(source, { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) {
    const path = join(entry.parentPath, entry.name);
    files[relative(source, path).replaceAll(sep, "/")] = await readFile(path);
  }
}

const { name, version } = JSON.parse(files["manifest.json"]);
const target = `release/${name.toLowerCase()}-${version}.zip`;
await writeFile(target, zipSync(files, { level: 9 }));
console.log(target);
