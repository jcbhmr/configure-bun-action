import cookiecutter from "../lib/cookiecutter.ts";
import * as prebun from "../lib/prebun.ts";
import.meta.resolve = import.meta.resolveSync;

export default async function bun0(rootPath: string) {
  const actionPath = ["action.yml", "action.yaml"]
    .map((x) => join(rootPath, x))
    .find((x) => existsSync(x))!;
  const action = YAML.parse(await readFile(actionPath, "utf8"));
  assert.equal(typeof action, "object");
  assert.equal(typeof action.runs, "object");
  assert.equal(action.runs.using, "bun0");

  assert.equal(typeof action.runs.main, "string");
  if ("pre" in action.runs) {
    assert.equal(typeof action.runs.pre, "string");
  }
  if ("post" in action.runs) {
    assert.equal(typeof action.runs.post, "string");
  }
  const { main, pre, post } = action.runs;

  const versionTags = await prebun.fetchVersionTagMap();
  let versions = Object.keys(versionTags);
  versions.sort(Bun.semver.order);
  versions = versions.filter((x) => Bun.semver.satisfies(x, "^0.0.0"));
  const version = versions.at(-1)!;
  const tag = versionTags[version];

  await cookiecutter(
    Bun.fileURLToPath(import.meta.resolve("./templates/.bun/")),
    join(rootPath, ".bun")
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
}
