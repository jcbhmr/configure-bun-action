import { spawn } from "node:child_process";
import { once } from "node:events";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";

const rootPath = dirname(process.argv[1]);
const filePath = join(rootPath, __RELATIVE_FILE_PATH__);
const osAndArch = `${process.env.RUNNER_OS.toLowerCase()}-${process.env.RUNNER_ARCH.toLowerCase()}`;
const exeExt = process.platform === "windows" ? ".exe" : "";

const committedBunInstallPath = join(rootPath, ".bun", osAndArch);
const committedBun = join(bunInstallPath, "bin", "bun" + exeExt);
upgrade_committed_version: {
  const signal = AbortSignal.timeout(5000);
  const s = spawn(committedBun, ["upgrade"], { signal });
  await once(s, "exit");
}

let toolCacheBunInstallPath;
let toolCacheBun;
move_committed_version_to_tool_cache: {
  const signal = AbortSignal.timeout(500);
  const s = spawn(committedBun, ["-v"], { signal });
  await once(s, "spawn");
  const versionP = new Response(ReadableStream.from(s.stdout)).text();
  const [exitCode] = await once();
  toolCacheBunInstallPath = join(
    process.env.RUNNER_TOOL_CACHE,
    "bun",
    committedBunVersion,
    process.arch
  );
  toolCacheBun = join(toolCacheBunInstallPath, "bin", "bun" + exeExt);
}
