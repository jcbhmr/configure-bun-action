import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { once } from "node:events";
const suffix = `${process.env.RUNNER_OS.toLowerCase()}-${process.env.RUNNER_ARCH.toLowerCase()}`;
const ext = process.platform === "win32" ? ".exe" : "";
const relative = `${"main"}-${suffix}${ext}`;
const file = join(dirname(process.argv[1]), relative);
const subprocess = spawn(file, { stdio: "inherit" });
process.exitCode = (await once(subprocess, "exit"))[0];
