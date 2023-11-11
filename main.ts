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
import * as bun from "./bun.ts";

const rootPath = resolve(core.getInput("path"));
const actionPath = ["action.yml", "action.yaml"]
  .map((x) => join(rootPath, x))
  .find((x) => existsSync(x))!;
const action = YAML.parse(await readFile(actionPath, "utf8"));
core.debug(`rootPath=${rootPath}`);
core.debug(`actionPath=${actionPath}`);
core.debug(`action=${JSON.stringify(action)}`);

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
core.debug(`using_=${using_}`);
core.debug(`main=${main}`);
core.debug(`pre=${pre}`);
core.debug(`post=${post}`);

let version: string;
let tag: string;
if (action.runs.using === "bun0") {
  version = "0.8.1";
  tag = "bun-v0.8.1";
  core.warning("bun0 is deprecated. Please use bun1 instead.");
} else {
  const versionTags = await bun.fetchVersionTagMap();
  let versions = Object.keys(versionTags);
  versions.sort(Bun.semver.order);
  versions = versions.filter((x) => Bun.semver.satisfies(x, "^1.0.0"));
  version = versions.at(-1)!;
  tag = versionTags[version];
}
core.debug(`version=${version}`);
core.debug(`tag=${tag}`);
assert.notEqual(version, null);
assert.notEqual(tag, null);

core.info(`Using Bun v${version}`);
const permutations: any[] = [
  { os: "Linux", arch: "X64", avx2: true },
  { os: "Linux", arch: "ARM64" },
  { os: "macOS", arch: "X64", avx2: true },
  { os: "macOS", arch: "ARM64" },
];
core.debug(`permutations=${JSON.stringify(permutations)}`);
for (const { os, arch, avx2, variant } of permutations) {
  const targetName = `${os}-${arch}`;
  const bunInstall = join(rootPath, ".bun", targetName);
  await bun.install(bunInstall, tag, os, arch, avx2, variant);
}

await cp(new URL("./templates/.bun", import.meta.url), join(rootPath, ".bun"), {
  recursive: true,
  force: true,
});
// TODO: Use standard cookiecutter-esque folder templating library
const stageTemplate = await readFile(
  join(rootPath, ".bun", "[stage].mjs"),
  "utf8"
);
const mainJS = stageTemplate.replaceAll(
  /__(STAGE|FILE_RELATIVE_PATH|LOCAL_BUN_VERSION)__/g,
  (match) =>
    ({
      __STAGE__: "main",
      __FILE_RELATIVE_PATH__: main,
      __LOCAL_BUN_VERSION__: version,
    }[match])
);
await writeFile(join(rootPath, ".bun", "main.mjs"), mainJS);
const preJS = stageTemplate.replaceAll(
  /__(STAGE|FILE_RELATIVE_PATH|LOCAL_BUN_VERSION)__/g,
  (match) =>
    ({
      __STAGE__: "pre",
      __FILE_RELATIVE_PATH__: pre,
      __LOCAL_BUN_VERSION__: version,
    }[match])
);
await writeFile(join(rootPath, ".bun", "pre.mjs"), preJS);
const postJS = stageTemplate.replaceAll(
  /__(STAGE|FILE_RELATIVE_PATH|LOCAL_BUN_VERSION)__/g,
  (match) =>
    ({
      __STAGE__: "post",
      __FILE_RELATIVE_PATH__: post,
      __LOCAL_BUN_VERSION__: version,
    }[match])
);
await writeFile(join(rootPath, ".bun", "post.mjs"), postJS);
await rm(join(rootPath, ".bun", "[stage].mjs"));

action.runs.using = "node20";
action.runs.main = ".bun/main.mjs";
action.runs.pre &&= ".bun/pre.mjs";
action.runs.post &&= ".bun/post.mjs";

core.debug(`action=${JSON.stringify(action)}`);
await writeFile(actionPath, YAML.stringify(action));
core.info(`Wrote action to ${actionPath}`);

await $`git add -f ${actionPath}`;
await $`git add -f ${join(rootPath, ".bun")}`;
core.info(`Added files to Git`);
