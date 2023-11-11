import { readFile } from "node:fs/promises";
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
assert.equal(typeof action, "object");
assert.equal(typeof action.runs, "object");
assert.equal(typeof action.runs.using, "string");

const params = {
  __proto__: null,
  async bun0() {
    const version = "0.8.1";
    const tag = "bun-v0.8.1";
    return { version, tag };
  },
  async bun1() {
    const versionTags = await prebun.fetchVersionTagMap();
    let versions = Object.keys(versionTags);
    versions.sort(Bun.semver.order);
    versions = versions.filter((x) => Bun.semver.satisfies(x, "^1.0.0"));
    const version = versions.at(-1)!;
    const tag = versionTags[version];
    return { version, tag };
  },
};
assert(action.runs.using in params);

assert.equal(typeof action.runs.main, "string");
if ("pre" in action.runs) {
  assert.equal(typeof action.runs.pre, "string");
}
if ("post" in action.runs) {
  assert.equal(typeof action.runs.post, "string");
}
const { main, pre, post } = action.runs;

const { version, tag } = await params[action.runs.using]();

await cookiecutter(
  Bun.fileURLToPath(import.meta.resolve("./templates/.bun/")),
  join(rootPath, ".bun"),
  {
    // vars!
  }
);
const permutations: any[] = [
  { os: "Linux", arch: "X64", avx2: true },
  { os: "Linux", arch: "ARM64" },
  { os: "macOS", arch: "X64", avx2: true },
  { os: "macOS", arch: "ARM64" },
];
for (const { os, arch, avx2, variant } of permutations) {
  const bunInstall = join(rootPath, ".bun", `${os}-${arch}`);
  await bun.install(bunInstall, tag, os, arch, avx2, variant);
}

action.runs.using = "node20";
action.runs.main = ".bun/main.mjs";
action.runs.pre &&= ".bun/pre.mjs";
action.runs.post &&= ".bun/post.mjs";

await writeFile(actionPath, YAML.stringify(action));
