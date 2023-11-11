import { spawn } from "node:child_process";
import { once } from "node:events";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

function escapeData(s) {
  return s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
}
function escapeProperty(s) {
  return s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C')
}
function coreDebug(x) {
  if (["1", "true"].includes(process.env.BUN_DEBUG)) {
    console.log(`::debug::${escapeData("jcbhmr/configure-bun-action\n" + x)}`);
  }
}
function coreWarn(x) {
  console.log(`::warning::${escapeData("jcbhmr/configure-bun-action\n" + x)}`);
}

function semverLt(a, b) {
  const [aMajor, aMinor, aPatch] = a.split(".").map((x) => parseInt(x));
  const [bMajor, bMinor, bPatch] = b.split(".").map((x) => parseInt(x));
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
  const major = range.match(/^\^(\d+)\.(\d+)\.(\d+)$/)[1];
  const inMajor = versions.filter((x) => x.startsWith(major + "."));
  inMajor.sort(semverCompare);
  return inMajor.at(-1);
}

async function getAllToolCacheBunVersions() {
  const toolCacheBunIndexPath = join(process.env.RUNNER_TOOL_CACHE, "bun");
  const dirNames = await readdir(toolCacheBunIndexPath).catch(() => []);
  const versions = dirNames.flatMap((x) => x.match(/^v?(\d+\.\d+\.\d+)$/)?.[1] ?? []);
  versions.sort(semverCompare);
  coreDebug(`getAllToolCacheBunVersions()=${JSON.stringify(versions)}`)
  return versions;
}

const fileRelativePath = "out/main.js";
const localBunVersion = "1.0.11";
coreDebug(`fileRelativePath=${fileRelativePath}`)
coreDebug(`localBunVersion=${localBunVersion}`)

const rootPath = fileURLToPath(import.meta.resolve("./"));
const filePath = join(rootPath, fileRelativePath);
const targetName = `${process.env.RUNNER_OS.toLowerCase()}-${process.env.RUNNER_ARCH.toLowerCase()}`;
const exeExt = process.platform === "windows" ? ".exe" : "";
coreDebug(`rootPath=${rootPath}`)
coreDebug(`filePath=${filePath}`)
coreDebug(`targetName=${targetName}`)
coreDebug(`exeExt=${exeExt}`)

const localBunInstallPath = join(rootPath, ".bun", targetName);
const toolCacheBunInstallPathFor = (version) => join(process.env.RUNNER_TOOL_CACHE, "bun", version, process.arch);
const bunPathFor = (bunInstallPath) => join(bunInstallPath, "bin", "bun" + exeExt);
coreDebug(`localBunInstallPath=${localBunInstallPath}`)

const copyLocalBunInstallToPath = toolCacheBunInstallPathFor(localBunVersion);
if (!existsSync(copyLocalBunInstallToPath)) {
  coreDebug(`copying ${localBunInstallPath} to ${copyLocalBunInstallToPath}`)
  await mkdir(dirname(copyLocalBunInstallToPath), { recursive: true });
  await cp(localBunInstallPath, copyLocalBunInstallToPath, { recursive: true });
  coreDebug(`copied ${localBunInstallPath} to ${copyLocalBunInstallToPath}`)
}
const allToolCacheBunVersions = await getAllToolCacheBunVersions();
const bestToolCacheBunVersion = semverMaxSatisfying(allToolCacheBunVersions, "^" + localBunVersion);
const bestBunPath = bunPathFor(toolCacheBunInstallPathFor(bestToolCacheBunVersion));
coreDebug(`bestToolCacheBunVersion=${bestToolCacheBunVersion}`)
coreDebug(`bestBunPath=${bestBunPath}`)

if (semverLt(bestToolCacheBunVersion, "1.0.0")) {
  coreWarn("bun0 is deprecated. Please upgrade to bun1.");
}

const bunChildProcess = spawn(bestBunPath, [filePath], { stdio: "inherit" });
const [bunExitCode] = await once(bunChildProcess, "exit");
coreDebug(`bunExitCode=${bunExitCode}`)
process.exitCode = bunExitCode;
