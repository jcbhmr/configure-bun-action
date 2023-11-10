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
import { once } from "node:events";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const root = dirname(process.argv[1]);
const file = join(root, ${JSON.stringify(file)});
let bun;
try {
  const signal = AbortSignal.timeout(6000);
  // https://github.com/oven-sh/bun/issues/6964
  const response = await fetch("https://raw.githubusercontent.com/jcbhmr/bun-versions/main/versions.json", { signal });
  assert(response.ok, \`\${response.status} \${response.url}\`);
  const json = await response.json();
  const TAG = json.bun.find((x) => x.startsWith("bun-v0."));
  const version = TAG.slice(5);
  const BUN_INSTALL = join(process.env.RUNNER_TOOL_CACHE, "bun", version, process.arch);
  if (!existsSync(BUN_INSTALL)) {
    const subprocess1 = spawn(
      \`curl -fsSL https://bun.sh/install | bash -s "$TAG"\`,
      { shell: "bash", env: { ...process.env, BUN_INSTALL, TAG }, signal }
    );
    const [exitCode] = await once(subprocess1, "exit");
    if (exitCode) {
      throw new DOMException(\`bun.sh/install exited with code \${exitCode}\`, "OperationError");
    }
  }
  bun = join(BUN_INSTALL, "bin", "bun");
} catch (error) {
  if (process.env.RUNNER_DEBUG === "1") {
    console.error(error);
  }
  const target = \`\${process.env.RUNNER_OS.toLowerCase()}-\${process.env.RUNNER_ARCH.toLowerCase()}\`;
  bun = join(root, ".bun", target, "bun");
}
const subprocess2 = spawn(bun, [file], { stdio: "inherit" });
process.exitCode = (await once(subprocess2, "exit"))[0];
`;

export default async function bun0(root: string, action: any) {
  assert(action.runs.using === "bun0", "must be bun0");

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
