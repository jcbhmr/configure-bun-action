import assert from "node:assert/strict";
import { join } from "node:path";
import { chmod, readFile, rename, rm } from "node:fs/promises";
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";
import { $ } from "execa";

async function fetchVersionTagMap() {
  const octokit = core.getInput("token")
    ? github.getOctokit(core.getInput("token"))
    : process.env.GH_TOKEN || process.env.GITHUB_TOKEN
    ? github.getOctokit((process.env.GH_TOKEN || process.env.GITHUB_TOKEN)!)
    : github.getOctokit(undefined!, {
        authStrategy: createUnauthenticatedAuth,
        auth: { reason: "no 'token' input, '$GH_TOKEN', or '$GITHUB_TOKEN'" },
      });

  const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: "oven-sh",
    repo: "bun",
  });

  const map = Object.create(null);
  for (const release of releases) {
    const version = release.tag_name.match(/^v?(\d+\.\d+\.\d+)$/)?.[1];
    if (!version) {
      continue;
    }
    map[version] = release.tag_name;
  }
  return map;
}

async function supportsAVX2() {
  if (process.platform === "win32") {
    const { stdout } = await $`wmic cpu get caption`;
    return /avx2/i.test(stdout);
  } else if (process.platform === "darwin") {
    const { stdout } = await $`sysctl -n machdep.cpu.features`;
    return /avx2/i.test(stdout);
  } else if (process.platform === "linux") {
    const data = await readFile("/proc/cpuinfo", "utf8");
    return /avx2/i.test(data);
  } else {
    return null;
  }
}

async function install(
  bunInstallPath: string,
  tag: string | undefined = undefined,
  os: "Windows" | "Linux" | "macOS" | undefined = undefined,
  arch: "X64" | "X86" | "ARM64" | "ARM" | undefined = undefined,
  avx2: boolean | undefined = undefined,
  variant: "debug-info" | null = null
) {
  if (tag === undefined) {
    const verionTags = await fetchVersionTagMap();
    const versions = Object.keys(verionTags);
    versions.sort(Bun.semver.order);
    assert(versions.length > 0);
    const latestVersion = versions.at(-1)!;
    tag = verionTags[latestVersion];
  }
  core.debug(`tag=${tag}`);

  if ([os, arch, avx2].some((x) => x === undefined)) {
    assert([os, arch, avx2].every((x) => x === undefined));
    // @ts-ignore
    os = {
      win32: "Windows",
      linux: "Linux",
      darwin: "macOS",
    }[process.platform]!;
    // @ts-ignore
    arch = {
      x64: "X64",
      x32: "X86",
      arm64: "ARM64",
      arm: "ARM",
    }[process.arch]!;
    avx2 = (await supportsAVX2()) ?? false;
  }
  core.debug(`os=${os}`);
  core.debug(`arch=${arch}`);
  core.debug(`avx2=${avx2}`);
  core.debug(`variant=${variant}`);

  core.info(`Installing Bun ${tag} to ${bunInstallPath} for ${os} ${arch}`);

  if (os === "Windows") {
    throw new DOMException(
      "No Bun installation available for Windows",
      "NotSupportedError"
    );
  }

  let target = {
    "macOS,X64": "darwin-x64",
    "macOS,ARM64": "darwin-aarch64",
    "Linux,ARM64": "linux-aarch64",
    "Linux,X64": "linux-x64",
  }[[os, arch].toString()];
  if (target === "darwin-x64") {
    avx2 ??= true;
    if (!avx2) {
      target = "darwin-x64-baseline";
    }
  }
  if (target === "linux-x64") {
    avx2 ??= true;
    if (!avx2) {
      target = "linux-x64-baseline";
    }
  }
  let exeName = "bun";
  if (variant === "debug-info") {
    target = `${target}-profile`;
    exeName = "bun-profile";
  }
  core.debug(`target=${target}`);

  const bunURI = `https://github.com/oven-sh/bun/releases/download/${tag}/bun-${target}.zip`;
  const bin = join(bunInstallPath, "bin");
  const exe = join(bin, "bun");
  core.debug(`bunURI=${bunURI}`);
  core.debug(`bin=${bin}`);
  core.debug(`exe=${exe}`);

  core.info(`Downloading Bun from ${bunURI}`);
  await tc.downloadTool(bunURI, `${exe}.zip`);
  await tc.extractZip(`${exe}.zip`, bin);
  core.debug(`moving ${join(bin, `bun-${target}`, exeName)} to ${exe}`);
  await rename(join(bin, `bun-${target}`, exeName), exe);
  core.debug(`chmod 0o755 ${exe}`);
  await chmod(exe, 0o755);
  core.debug(`rm -r ${join(bin, `bun-${target}`)}`);
  await rm(join(bin, `bun-${target}`), { recursive: true });
  core.info(`Installed Bun to ${exe}`);
}

export { install, fetchVersionTagMap };
