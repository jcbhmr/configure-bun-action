import {
  chmod,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { join } from "node:path";
import * as tc from "@actions/tool-cache";
import assert from "node:assert/strict";
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { findUp } from "find-up";
import * as YAML from "yaml";
import { pipeline } from "node:stream/promises";

export async function bunMetaInstall(
  dest: string,
  tag: string,
  runnerOs: "Windows" | "Linux" | "macOS",
  runnerArch: "X64" | "X86" | "ARM64" | "ARM",
  variant: "debug-info" | null = null
) {
  let target = {
    "Linux,X64": "linux-x64",
    "Linux,ARM64": "linux-arm64",
    "macOS,X64": "darwin-x64",
    "macOS,ARM64": "darwin-arm64",
  }[[runnerOs, runnerArch].toString()];
  if (!target) {
    throw new DOMException(
      `${runnerOs} ${runnerArch} is not supported by Bun`,
      "NotSupportedError"
    );
  }

  let exeName = "bun";
  if (variant === "debug-info") {
    target = `${target}-profile`;
    exeName = "bun-profile";
  }

  const bunURI = `https://github.com/oven-sh/bun/releases/download/${tag}/bun-${target}.zip`;
  const bin = join(dest, "bin");
  const exe = join(bin, "bun");

  await mkdir(bin, { recursive: true });
  const temp = await tc.downloadTool(bunURI);
  await tc.extractZip(temp, bin);
  await rename(join(bin, `bun-${target}`, exeName), exe);
  await chmod(exe, 0o755);
  await rm(join(bin, `bun-${target}`), { recursive: true });
}

export const octokit = core.getInput("token")
  ? github.getOctokit(core.getInput("token"))
  : process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  ? github.getOctokit((process.env.GH_TOKEN || process.env.GITHUB_TOKEN)!)
  : github.getOctokit(undefined!, {
      authStrategy: createUnauthenticatedAuth,
      auth: { reason: "no 'token' input, '$GH_TOKEN', or '$GITHUB_TOKEN'" },
    });

export async function bunMetaList() {
  const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: "oven-sh",
    repo: "bun",
  });

  const map: Record<string, string> = { __proto__: null! };
  for (const release of releases) {
    const version = release.tag_name.match(/^(?:bun-)?v?(\d+\.\d+\.\d+)$/)?.[1];
    if (!version) {
      continue;
    }
    map[version] = release.tag_name;
  }
  assert.notEqual(
    Object.keys(map).length,
    0,
    `no versions found ${JSON.stringify(releases)}`
  );
  return map;
}

export async function readAction(rootOrPath: string) {
  const actionPath = await findUp(["action.yml", "action.yaml"], {
    cwd: rootOrPath,
    type: "file",
  });
  assert(actionPath, `no action.yml found in ${rootOrPath}`);

  const actionDoc = YAML.parseDocument(await readFile(actionPath, "utf8"));
  return actionDoc;
}

export async function writeAction(
  rootPath: string,
  actionDoc: YAML.Document.Parsed
) {
  let actionPath = await findUp(["action.yml", "action.yaml"], {
    cwd: rootPath,
    type: "file",
  });
  if (!actionPath) {
    actionPath = join(rootPath, "action.yml");
  }
  await writeFile(actionPath, actionDoc.toString());
}

export async function gzip(path: string) {
  await pipeline(
    createReadStream(path),
    // @ts-ignore
    new CompressionStream("gzip"),
    createWriteStream(`${path}.gz`)
  );
  await rm(path);
}
