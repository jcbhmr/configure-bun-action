import { fileURLToPath } from "node:url";
import * as core from "./lib/actions+core.mjs";
import * as tc from "./lib/actions+tool-cache.mjs";
import * as Bun from "./lib/bun.mjs";
import { $ } from "./lib/execa.mjs";

export default async function doIt(fileRelativePath, localBunVersion, stage) {
  const 
const $$ = $({ stdio: "inherit" });
const rootPath = fileURLToPath(import.meta.resolve("../"));
const targetName = `${process.env.RUNNER_OS}-${process.env.RUNNER_ARCH}`;
const exeExt = process.platform === "win32" ? ".exe" : "";
const localBunInstallPath = fileURLToPath(
  import.meta.resolve(`./${targetName}/`)
);
const bunPathFor = (bunInstallPath) =>
  join(bunInstallPath, "bin", "bun" + exeExt);

await tc.cacheDir(localBunInstallPath, "bun", localBunVersion);
const found = tc.find("bun", `^${localBunVersion}`);

const bun = bunPathFor(found);
const filePath = join(rootPath, fileRelativePath);
const { exitCode } = await $$`${bun} ${filePath}`;
process.exitCode = exitCode;
