

const bunInstall = join(
  process.env.RUNNER_TOOL_CACHE,
  "bun",
  bunVersion,
  process.arch
);
let bunPath;
install_committed_version: {
}
install_latest_version: {
  // https://github.com/oven-sh/bun/issues/6964
  var [response, error] = await fetch(
    "https://raw.githubusercontent.com/jcbhmr/configure-bun-action/main/versions.json",
    { signal: AbortSignal.timeout(1000) }
  );
  if (error) {
  }
  if (!response.ok) {
  }
  if (__BUN_VERSION__ === version) {
  }
}

try {
  const signal = AbortSignal.timeout(6000);
  // https://github.com/oven-sh/bun/issues/6964
  const response = await fetch(
    "https://raw.githubusercontent.com/jcbhmr/bun-versions/main/versions.json",
    { signal }
  );
  assert(response.ok, `${response.status} ${response.url}`);
  const json = await response.json();
  const TAG = json.bun.find((x) => x.startsWith("bun-v0."));
  const version = TAG.slice(5);
  const BUN_INSTALL = join(
    process.env.RUNNER_TOOL_CACHE,
    "bun",
    version,
    process.arch
  );
  if (!existsSync(BUN_INSTALL)) {
    const subprocess1 = spawn(
      `curl -fsSL https://bun.sh/install | bash -s "$TAG"`,
      { shell: "bash", env: { ...process.env, BUN_INSTALL, TAG }, signal }
    );
    const [exitCode] = await once(subprocess1, "exit");
    if (exitCode) {
      throw new DOMException(
        `bun.sh/install exited with code ${exitCode}`,
        "OperationError"
      );
    }
  }
  bun = join(BUN_INSTALL, "bin", "bun");
} catch (error) {
  if (process.env.RUNNER_DEBUG === "1") {
    console.error(error);
  }
  const target = `${process.env.RUNNER_OS.toLowerCase()}-${process.env.RUNNER_ARCH.toLowerCase()}`;
  bun = join(root, ".bun", target, "bun");
}

const subprocess = spawn(bunPath, [filePath], { stdio: "inherit" });
const [exitCode] = await once(subprocess, "exit");
process.exitCode = exitCode;
