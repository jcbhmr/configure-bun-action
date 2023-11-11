import { stat, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const evalText = (t, v) => t.replace(/__(\w+)__/g, (m, x) => v[x] || m);
const evalPath = (p, v) => p.replace(/\[(\w+)\]/g, (m, x) => v[x] || m);
async function cookiecutter(src, dest, vars) {
  const stats = await stat(src);
  if (stats.isDirectory()) {
    await mkdir(dest, { recursive: true });
  } else {
    await mkdir(dirname(dest), { recursive: true });
  }
  if (stats.isDirectory()) {
    for (const name of await readdir(src)) {
      const srcPath = join(src, name);
      const destPath = join(dest, evalPath(name, vars));
      await cookiecutter(srcPath, destPath, vars);
    }
  } else {
    let text = await readFile(src, "utf8");
    text = evalText(text, vars);
    await writeFile(join(dest, evalPath(basename(src))));
  }
}

export default cookiecutter;
