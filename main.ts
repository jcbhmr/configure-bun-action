import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as core from "@actions/core";
import * as YAML from "yaml";

const root = core.getInput("path");
core.debug(`root=${root}`);

const actionPath = ["action.yml", "action.yaml"]
  .map((x) => join(root, x))
  .find((x) => existsSync(x))!;

const action = YAML.parse(await readFile(actionPath, "utf8"));
core.debug(`actionPath=${actionPath}`);
core.debug(`action.runs=${JSON.stringify(action.runs)}`);

if (action.runs.using === "bun0") {
  const { default: bun0 } = await import("./bun0.ts");
  await bun0(root, action);
} else if (action.runs.using === "bun1") {
  const { default: bun1 } = await import("./bun1.ts");
  await bun1(root, action);
} else {
  throw new DOMException(
    `${action.runs.using} is not 'bun0' or 'bun1'`,
    "NotSupportedError"
  );
}

core.debug(`action.runs=${JSON.stringify(action.runs)}`);
await writeFile(actionPath, YAML.stringify(action));
