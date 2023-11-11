import { stat, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

export default async function cookiecutter(src, dest, vars) {
  if ((await stat(src)).isDirectory()) {
    await mkdir(dest);
    for (const name of await readdir(src)) {
      const srcPath = join(src, name);
      const destPath = join(dest, name);
      await cookiecutter(srcPath, destPath, vars);
    }
  } else {
    let text = await readFile(src, "utf8");
    text = text.replace(/__(\w+)__/g, (m, x) => vars[x] || m);
    await writeFile(join(dirname(dest), basename(src)), text);
  }
}
