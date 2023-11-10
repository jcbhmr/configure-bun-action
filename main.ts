import {
  readFile,
  writeFile,
  cp,
  mkdir,
  rename,
  rm,
  chmod,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as YAML from "yaml";
import { $ } from "execa";
import assert from "node:assert/strict";
import * as github from "@actions/github";
import * as semver from "semver";

const mainTemplate = (fileRelativePath: string, localBunVersion: string) => `\
const fileRelativePath = ${JSON.stringify(fileRelativePath)};
const localBunVersion = ${JSON.stringify(localBunVersion)};

import { spawn } from "node:child_process";
import { once } from "node:events";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const rootPath = fileURLToPath(import.meta.resolve("./"));
const filePath = join(rootPath, fileRelativePath);
const targetName = \`\${process.env.RUNNER_OS.toLowerCase()}-\${process.env.RUNNER_ARCH.toLowerCase()}\`;
const exeExt = process.platform === "windows" ? ".exe" : "";

function coreDebug(x) {
  console.log("::debug::%s", x);
}

function semverLt(a, b) {
  const [aMajor, aMinor, aPatch] = a.split(".").map((x) => parseInt(x));
  const [aMajor, aMinor, aPatch] = b.split(".").map((x) => parseInt(x));
  if (aMajor < bMajor) {
    return true;
  } else if (aMajor > bMajor) {
    return false;
  }
  if (aMinor < bMinor) {
    return true;
  } else if (aMinor > bMinor) {
    return false;
  }
  return aPatch < bPatch;
}
const semverGt = (a, b) => !semverLt(a, b) && a !== b;
function semverCompare(a, b) {
  if (semverLt(a, b)) {
    return -1;
  } else if (semverGt(a, b)) {
    return 1;
  }
  return 0;
}
function semverMaxSatisfying(versions, range) {
  const major = range.match(/^\\^(\\d+)\\.0\\.0$/)[1];
  const inMajor = versions.filter((x) => x.startsWith(major + "."));
  inMajor.sort(semverCompare);
  return inMajor.at(-1);
}

async function getAllToolCacheBunVersions() {
  const toolCacheBunIndexPath = join(process.env.RUNNER_TOOL_CACHE, "bun");
  const dirNames = await readdir(toolCacheBunIndexPath).catch(() => []);
  return dirNames.flatMap((x) => x.match(/^v?(\\d+\\.\\d+\\.\\d+)$/)?.[1] ?? []);
}

const localBunInstallPath = join(rootPath, ".bun", targetName);
const toolCacheBunInstallPathFor = (version) => join(process.env.RUNNER_TOOL_CACHE, "bun", version, process.arch);
const bunPathFor = (bunInstallPath) => join(bunInstallPath, "bin", "bun" + exeExt);

const copyLocalBunInstallToPath = toolCacheBunInstallPathFor(localBunVeresion);
if (!existsSync(copyLocalBunInstallToPath)) {
  await mkdir(dirname(copyLocalBunInstallToPath), { recursive: true });
  await cp(localBunInstallPath, copyLocalBunInstallToPath, { recursive: true });
}
const bestToolCacheBunVersion = semverMaxSatisfying(await getAllToolCacheBunVersions(), "^" + localBunVersion);
const bestBunPath = bunPathFor(toolCacheBunInstallPathFor(bestToolCacheBunVersion));

const bunChildProcess = spawn(bestBunPath, [filePath], { stdio: "inherit" });
const [bunExitCode] = await once(bunChildProcess, "exit");
process.exitCode = bunExitCode;
`;
const preTemplate = mainTemplate;
const postTemplate = mainTemplate;

async function getAllBunTags() {
  const token = core.getInput("token");
  const octokit = token ? github.getOctokit(token) : new Octokit(); // TODO: https://www.npmjs.com/package/@octokit/auth-unauthenticated
  const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: "oven-sh",
    repo: "bun",
  });
  return releases.map((x) => x.tag_name);
}

async function installBun(
  bunInstallPath: string,
  tag: string,
  os: "Windows" | "Linux" | "macOS",
  arch: "X64" | "X86" | "ARM64" | "ARM",
  avx2: boolean = true,
  variant: "debug-info" | "" = ""
) {
  if (os === "Windows") {
    throw new DOMException(
      "No Bun installation available for Windows",
      "NotSupportedError"
    );
  }

  let target = {
    "macOS,X64": "darwin-64",
    "macOS,ARM64": "darwin-aarch64",
    "Linux,ARM64": "linux-aarch64",
    "Linux,X64": "linux-x64",
  }[[os, arch].toString()];

  if (target === "darwin-x64" && !avx2) {
    target = "darwin-x64-baseline";
  }

  if (target === "linux-x64" && !avx2) {
    target = "linux-x64-baseline";
  }

  let exeName = "bun";
  if (variant === "debug-info") {
    target = `${target}-profile`;
    exeName = "bun-profile";
  }

  const bunURI = `https://github.com/oven-sh/bun/releases/download/${tag}/bun-${target}.zip`;
  const bin = join(bunInstallPath, "bin");
  const exe = join(bin, "bun");
  await tc.downloadTool(bunURI, `${exe}.zip`);
  await tc.extractZip(`${exe}.zip`, bin);
  await rename(join(bin, `bun-${target}`, exeName), exe);
  await chmod(exe, 0o755);
  await rm(join(bin, `bun-${target}`), { recursive: true });
}

const rootPath = resolve(core.getInput("path"));
const actionPath = ["action.yml", "action.yaml"]
  .map((x) => join(rootPath, x))
  .find((x) => existsSync(x))!;
const action = YAML.parse(await readFile(actionPath, "utf8"));
assert.equal(typeof action, "object");
assert.equal(typeof action.runs, "object");
assert.match(action.runs.using, /^bun(0|1)$/);

const { using: using_, main, pre, post } = action.runs;
assert.equal(typeof main, "string");
if (pre !== undefined) {
  assert.equal(typeof pre, "string");
}
if (post !== undefined) {
  assert.equal(typeof post, "string");
}

const avx2 = core.getBooleanInput("avx2");
const variant = core.getInput("variant");

const tags = await getAllBunTags();
const range = action.runs.using === "bun0" ? "^0.0.0" : "^1.0.0";
const versions = tags.map((x) => semver.coerce(x));
const version = semver.maxSatisfying(versions, range);
const tag = tags[versions.indexOf(version)];

const permutations = [
  { os: "Linux", arch: "X64" },
  { os: "Linux", arch: "ARM64" },
  { os: "macOS", arch: "X64" },
  { os: "macOS", arch: "ARM64" },
];
for (const { os, arch } of permutations) {
  const localTargetName = `${os.toLowerCase()}-${arch.toLowerCase()}`;
  await installBun(
    join(rootPath, ".bun", localTargetName),
    tag,
    os,
    arch,
    avx2,
    variant
  );
}

action.runs.using = "node20";

const mainText = mainTemplate(main, version);
await writeFile(join(rootPath, "_main.mjs"), mainText);
action.runs.main = "_main.mjs";

if (pre != null) {
  const preText = preTemplate(pre, version);
  await writeFile(join(rootPath, "_pre.mjs"), preText);
  action.runs.pre = "_pre.mjs";
}

if (post != null) {
  const postText = postTemplate(post, version);
  await writeFile(join(rootPath, "_post.mjs"), postText);
  action.runs.post = "_post.mjs";
}

await writeFile(actionPath, YAML.stringify(action));

const addFiles = [
  actionPath,
  join(rootPath, ".bun"),
  join(rootPath, "_main.mjs"),
  join(rootPath, "_pre.mjs"),
  join(rootPath, "_post.mjs"),
];
await $({ stdio: "inherit", reject: false })`git add -f ${addFiles}`;
