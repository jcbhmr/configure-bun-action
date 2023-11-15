import { dirname, join } from "node:path";
import { $ } from "execa";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { findUp } from "find-up";
import * as YAML from "yaml";
import assert from "node:assert/strict";

export async function gunzip(path: string) {
  if (existsSync(`${path}.gz`)) {
    path = `${path}.gz`;
  }
  await pipeline(
    createReadStream(path),
    // @ts-ignore
    new DecompressionStream("gzip"),
    createWriteStream(path.replace(/\.gz$/, ""))
  );
  await rm(path);
}

export async function main(stage: "main" | "pre" | "post") {
  const actionPath = await findUp(["action.yml", "action.yaml"], {
    cwd: new URL(import.meta.url),
    type: "file",
  });
  assert(actionPath, `no action.yml found from ${import.meta.url}`);
  const rootPath = dirname(actionPath);
  const action = YAML.parse(await readFile(actionPath, "utf8"));

  const targetName = `${process.env.RUNNER_OS}-${process.env.RUNNER_ARCH}`;
  const exeExt = process.platform === "win32" ? ".exe" : "";

  const localBunInstallPath = join(rootPath, ".bun", targetName);

  const bun = join(localBunInstallPath, "bin", "bun" + exeExt);
  await gunzip(bun);
  const filePath = join(rootPath, action.runs[stage]!);
  const { exitCode, signal } = await $({
    stdio: "inherit",
    reject: false,
  })`${bun} ${filePath}`;
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(exitCode);
  }
}
