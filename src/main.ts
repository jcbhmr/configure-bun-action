import * as core from "@actions/core";
import {
  bunMetaInstall,
  bunMetaList,
  gzip,
  readAction,
  writeAction,
} from "./utils.ts";
import * as semver from "semver";
import assert from "node:assert/strict";
import * as YAML from "yaml";
import { join } from "node:path";
import { cp } from "node:fs/promises";

const rootPath = core.getInput("path");

const params = {
  __proto__: null,
  async bun0() {
    const version = "0.8.1";
    const tag = "bun-v0.8.1";
    return { version, tag };
  },
  async bun1() {
    const versionTags = await bunMetaList();
    let versions = Object.keys(versionTags);
    const version = semver.maxSatisfying(versions, "^1.0.0");
    assert(version, "no version found");
    const tag = versionTags[version];
    return { version, tag };
  },
};

mutate_it: {
  const actionDoc = await readAction(rootPath);

  const runs = actionDoc.get("runs") as YAML.Document.Parsed;
  if (!runs) {
    core.warning("no 'runs' in action");
    break mutate_it;
  }
  if (typeof runs !== "object") {
    core.warning("'runs' is not an object");
    break mutate_it;
  }
  const runsUsing = runs.get("using");
  if (!runsUsing) {
    core.warning("no 'runs.using' in action");
    break mutate_it;
  }
  if (typeof runsUsing !== "string") {
    core.warning("'runs.using' is not a string");
    break mutate_it;
  }
  if (!(runsUsing in params)) {
    core.warning(`'runs.using' is not in ${Object.keys(params)}`);
    break mutate_it;
  }
  const { version, tag } = await params[runsUsing as "bun0" | "bun1"]();

  await cp(new URL(import.meta.resolve("./runtime/")), join(rootPath, ".bun"), {
    recursive: true,
  });

  // avx2 assumed to be true
  const installMatrix = [
    { os: "Linux", arch: "X64" },
    { os: "Linux", arch: "ARM64" },
    { os: "macOS", arch: "X64" },
    { os: "macOS", arch: "ARM64" },
  ] as const;
  for (const { os, arch } of installMatrix) {
    const targetName = `${os}-${arch}`;
    const installPath = join(rootPath, ".bun", targetName);
    await bunMetaInstall(installPath, tag, os, arch);
    await gzip(join(installPath, "bin", "bun"));
  }

  // preserve the original action.yml runs into the .bun key
  // and add some meta
  const dotBunData = runs.toJSON();
  dotBunData.version = version;
  runs.set(".bun", dotBunData);

  const runsMain = runs.get("main");
  if (!runsMain) {
    core.warning("no 'runs.main' in action");
    break mutate_it;
  }
  if (typeof runsMain !== "string") {
    core.warning("'runs.main' is not a string");
    break mutate_it;
  }
  const runsPre = runs.get("pre");
  if (runsPre != null && typeof runsPre !== "string") {
    core.warning("'runs.pre' is not a string");
    break mutate_it;
  }
  const runsPost = runs.get("post");
  if (runsPost != null && typeof runsPost !== "string") {
    core.warning("'runs.post' is not a string");
    break mutate_it;
  }
  runs.set("using", "node20");
  runs.set("main", ".bun/main.mjs");
  if (runsPre != null) {
    runs.set("pre", ".bun/pre.mjs");
  }
  if (runsPost != null) {
    runs.set("post", ".bun/post.mjs");
  }

  await writeAction(rootPath, actionDoc);
}
