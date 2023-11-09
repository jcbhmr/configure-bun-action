import { stat, readFile, writeFile } from "node:fs/promises";
import * as core from "@actions/core";
import * as YAML from "yaml";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = core.getInput("path");
const actionPath = ["action.yml", "action.yaml"]
  .map((x) => join(root, x))
  .find((x) => existsSync(x));
const action = YAML.parse(await readFile(actionPath, "utf8"));

assert(action.runs.using === "bun1", `unknown ${action.runs.using}`);
action.runs.using = "node20";
for (const stage of ["main", "pre", "post"]) {
  const entry = core.getInput(stage) || action.runs[stage];
  if (entry) {
    const text = `\
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { once } from "node:events";
const suffix = \`\${process.env.RUNNER_OS.toLowerCase()}-\${process.env.RUNNER_ARCH.toLowerCase()}\`;
const ext = process.platform === "win32" ? ".exe" : "";
const relative = \`\${${JSON.stringify(stage)}}-\${suffix}\${ext}\`;
const file = join(dirname(process.argv[1]), relative);
const subprocess = spawn(file, { stdio: "inherit" });
process.exitCode = (await once(subprocess, "exit"))[0];
`;
    action.runs[stage] = `_${stage}.mjs`;
    await writeFile(join(root, action.runs[stage]), text);
  }
}
await writeFile(actionPath, YAML.stringify(action));
