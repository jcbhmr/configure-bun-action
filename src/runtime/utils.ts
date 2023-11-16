import { dirname, join } from "node:path";
import { $ } from "execa";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { chmod, readFile, rm, stat } from "node:fs/promises";
import { findUp } from "find-up";
import * as YAML from "yaml";
import assert from "node:assert/strict";
import { createGunzip } from "node:zlib";

export async function gunzip(path: string) {
  await pipeline(
    createReadStream(`${path}.gz`),
    createGunzip(),
    createWriteStream(path)
  );
  await chmod(path, (await stat(`${path}.gz`)).mode)
  await rm(`${path}.gz`);
}

export async function main(stage: "main" | "pre" | "post") {
  const actionPath = await findUp(["action.yml", "action.yaml"], {
    cwd: new URL(import.meta.url),
    type: "file",
  });
  assert(actionPath, `no action.yml found from ${import.meta.url}`);
  const rootPath = dirname(actionPath);
  const action = YAML.parse(await readFile(actionPath, "utf8"));
  const dotBunData = action[".bun"]

  const targetName = `${process.env.RUNNER_OS}-${process.env.RUNNER_ARCH}`;

  const localBunInstallPath = join(rootPath, ".bun", targetName);

  const bun = join(localBunInstallPath, "bin", "bun");
  if (existsSync(`${bun}.gz`)) {
    await gunzip(bun);
  }
  const filePath = join(rootPath, dotBunData[stage]!);
  console.log(bun, filePath)
  const { failed, escapedCommand, exitCode, signal } = await $({
    stdio: "inherit",
    reject: false,
  })`${bun} ${filePath}`;
  console.log(exitCode, signal)
  if (failed) {
    console.error(escapedCommand, "failed")
    process.exit(100)
  } else if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(exitCode);
  }
}
