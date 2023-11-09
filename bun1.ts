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

export default async function bun1(root: string, action: any) {
  assert(action.runs.using === "bun1", "must be bun1");

  const octokit = github.getOctokit(core.getInput("token"));
  const releases = await octokit.paginate(octokit.repos.listReleases, {
    owner: "oven-sh",
    repo: "bun",
  });
  const tags = releases.map((x) => x.tag_name);
  const versions = tags.map((x) => semver.coerce(x));
  const version = semver.maxSatisfying(versions, "^1.0.0");
  core.info(`using bun v${version}`);
  const tag = tags[versions.indexOf(version)];
  core.debug(`tag=${tag}`);

  const targetFilenames = {
    "linux-x64": "bun-linux-x64.zip",
    "linux-arm64": "bun-linux-aarch64.zip",
    "macos-x64": "bun-darwin-x64.zip",
    "macos-arm64": "bun-darwin-aarch64.zip",
  };
  core.debug(`targetFilenames=${JSON.stringify(targetFilenames)}`);
  for (const [target, filename] of Object.entries(targetFilenames)) {
    const response = await fetch(
      `https://github.com/oven-sh/bun/releases/download/${tag}/${filename}`
    );
    core.debug(`response.status=${response.status}`);
    assert(response.ok, `${response.status} ${response.url}`);
    const downloaded = join(process.env.RUNNER_TEMP!, filename);
    await pipeline(response.body, createWriteStream(downloaded));
    core.debug(`downloaded=${downloaded}`);

    const bunInstallTemp = join(process.env.RUNNER_TEMP!, "bun-install");
    core.info(`unzipping ${downloaded} to ${bunInstallTemp}`);
    await $`unzip ${downloaded} -d ${bunInstallTemp}`;
    const bunInstallTempActual = join(bunInstallTemp, parse(filename).name);

    const BUN_INSTALL = join(root, ".bun", target);
    core.info(`moving ${bunInstallTempActual} to ${BUN_INSTALL}`);
    await mkdir(BUN_INSTALL, { recursive: true });
    await rename(bunInstallTempActual, BUN_INSTALL);

    core.debug(`$BUN_INSTALL=${JSON.stringify(await readdir(BUN_INSTALL))}`);
  }

  action.runs.using = "node20";

  const target = `${process.env.RUNNER_OS!.toLowerCase()}-${process.env.RUNNER_ARCH!.toLowerCase()}`;
  const BUN_INSTALL = join(root, ".bun", target);
  async function bundle(root: string, file: string) {
    const bun = join(BUN_INSTALL, "bun");
    core.debug(`bun=${bun}`);

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
  core.debug(`mainBundle=${mainBundle}`);
  action.runs.main = "_main.mjs";
  await writeFile(join(root, action.runs.main), wrapper(mainBundle));
  core.info(`wrote ${action.runs.main}`);

  if (action.runs.pre) {
    const preBundle = await bundle(root, action.runs.pre);
    core.debug(`preBundle=${preBundle}`);
    action.runs.pre = "_pre.mjs";
    await writeFile(join(root, action.runs.pre), wrapper(preBundle));
    core.info(`wrote ${action.runs.pre}`);
  }

  if (action.runs.post) {
    const postBundle = await bundle(root, action.runs.post);
    core.debug(`postBundle=${postBundle}`);
    action.runs.post = "_post.mjs";
    await writeFile(join(root, action.runs.post), wrapper(postBundle));
    core.info(`wrote ${action.runs.post}`);
  }

  core.debug(`.=${JSON.stringify(await readdir(root))}`);
  core.debug(`.bun=${JSON.stringify(await readdir(join(root, ".bun")))}`);
  core.debug(`dist=${JSON.stringify(await readdir(join(root, "dist")))}`);
}
