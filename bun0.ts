import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { $ } from "execa";
import { dirname, join, parse, resolve } from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as semver from "semver";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const wrapper = (file: string) => `\
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { once } from "node:events";
const target = \`\${process.env.RUNNER_OS.toLowerCase()}-\${process.env.RUNNER_ARCH.toLowerCase()}\`;
const BUN_INSTALL = join(dirname(process.argv[1]), ".bun", target);
const file = join(dirname(process.argv[1]), ${JSON.stringify(file)});
const subprocess = spawn(join(BUN_INSTALL, "bin", "bun"), [file], { stdio: "inherit" });
process.exitCode = (await once(subprocess, "exit"))[0];
`;

export default async function bun0(root: string, action: any) {
  assert(action.runs.using === "bun0", "must be bun0");

  core.warning(
    "bun0 is deprecated. " +
      "Please upgrade to bun1. " +
      "bun0 may be removed in a future release."
  );

  const version = "0.8.1";
  core.info(`using bun v${version}`);
  const tag = "bun-v0.8.1";
  core.debug(`tag=${tag}`);

  const targetFilenames = {
    "linux-x64": "bun-linux-x64.zip",
    "linux-arm64": "bun-linux-aarch64.zip",
    "macos-x64": "bun-darwin-x64.zip",
    "macos-arm64": "bun-darwin-aarch64.zip",
  };
  for (const [target, filename] of Object.entries(targetFilenames)) {
    const response = await fetch(
      `https://github.com/oven-sh/bun/releases/download/${tag}/${filename}`
    );
    assert(response.ok, `${response.status} ${response.url}`);
    const downloaded = join(process.env.RUNNER_TEMP!, filename);
    await pipeline(response.body, createWriteStream(downloaded));
    const BUN_INSTALL = join(root, ".bun", target);
    core.info(`unzipping ${downloaded} to ${BUN_INSTALL}`);
    await mkdir(BUN_INSTALL, { recursive: true });
    await $`unzip ${downloaded} -d ${BUN_INSTALL}`;
  }

  action.runs.using = "node20";

  const target = `${process.env.RUNNER_OS!.toLowerCase()}-${process.env.RUNNER_ARCH!.toLowerCase()}`;
  const BUN_INSTALL = join(root, ".bun", target);
  async function bundle(root: string, file: string) {
    const bun = join(BUN_INSTALL, "bin", "bun");
    const in_ = join(root, file);
    const out = join(root, `dist/${parse(file).name}.js`);
    core.info(`bundling ${in_} to ${out}`);
    await mkdir(dirname(out), { recursive: true });
    await $({
      shell: "bash",
    })`${bun} build --target=bun ${in_} --outfile=${out}`;
    return out;
  }

  const mainBundle = await bundle(root, action.runs.main);
  action.runs.main = "_main.mjs";
  await writeFile(join(root, action.runs.main), wrapper(mainBundle));

  if (action.runs.pre) {
    const preBundle = await bundle(root, action.runs.pre);
    action.runs.pre = "_pre.mjs";
    await writeFile(join(root, action.runs.pre), wrapper(preBundle));
  }

  if (action.runs.post) {
    const postBundle = await bundle(root, action.runs.post);
    action.runs.post = "_post.mjs";
    await writeFile(join(root, action.runs.post), wrapper(postBundle));
  }
}
