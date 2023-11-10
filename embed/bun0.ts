import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
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

  const response = await fetch(
    "https://raw.githubusercontent.com/jcbhmr/bun-versions/main/versions.json"
  );
  const json = await Response.json();
  const tag = json.bun.find((x) => x.startsWith("bun-v0."));
  const version = tag.slice(5);
  core.info(`using bun v${version}`);
  core.debug(`tag=${tag}`);

  // https://github.com/oven-sh/bun/blob/main/src/cli/install.sh
  const map = {
    "linux-x64": "bun-linux-x64.zip",
    "linux-arm64": "bun-linux-aarch64.zip",
    "macos-x64": "bun-darwin-x64.zip",
    "macos-arm64": "bun-darwin-aarch64.zip",
  };
  core.debug(`map=${JSON.stringify(map)}`);
  for (const [target, filename] of Object.entries(map)) {
    const response = await fetch(
      `https://github.com/oven-sh/bun/releases/download/${tag}/${filename}`
    );
    core.debug(`${response.status} ${response.url}`);
    assert(response.ok, `${response.status} ${response.url}`);
    const zip = join(process.env.RUNNER_TEMP!, filename);
    await pipeline(response.body, createWriteStream(zip));
    core.debug(`zip=${zip}`);

    const bunInstallTemp = join(process.env.RUNNER_TEMP!, "bun-install");
    core.info(`unzipping ${zip} to ${bunInstallTemp}`);
    await $`unzip ${zip} -d ${bunInstallTemp}`;
    const bunInstallTempActual = join(bunInstallTemp, parse(filename).name);

    const BUN_INSTALL = join(root, ".bun", target);
    core.info(`moving ${bunInstallTempActual} to ${BUN_INSTALL}`);
    await mkdir(BUN_INSTALL, { recursive: true });
    await rename(bunInstallTempActual, BUN_INSTALL);
  }

  action.runs.using = "node20";

  const main = wrapper(action.runs.main);
  core.debug(`main=${main}`);
  action.runs.main = "_main.mjs";
  await writeFile(join(root, action.runs.main), main);
  core.info(`wrote ${action.runs.main}`);

  if (action.runs.pre) {
    const pre = wrapper(action.runs.pre);
    core.debug(`pre=${pre}`);
    action.runs.pre = "_pre.mjs";
    await writeFile(join(root, action.runs.pre), pre);
    core.info(`wrote ${action.runs.pre}`);
  }

  if (action.runs.post) {
    const post = wrapper(action.runs.post);
    core.debug(`post=${post}`);
    action.runs.post = "_post.mjs";
    await writeFile(join(root, action.runs.post), post);
    core.info(`wrote ${action.runs.post}`);
  }
}
