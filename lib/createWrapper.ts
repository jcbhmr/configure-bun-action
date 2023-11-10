import assert from "node:assert/strict";

export default async function createWrapper(
  relativeFilePath: string,
  bunVersion: string
) {
  const result = await Bun.build({
    entrypoints: [fileURLToPath(import.meta.resolve("./wrapper-template.ts"))],
    target: "node",
    define: {
      __RELATIVE_FILE_PATH__: JSON.stringify(file),
      __BUN_VERSION__: JSON.stringify(bunVersion),
    },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, "Build failed");
  }
  assert.equal(result.outputs.length, 1);
  const [artifact] = results.outputs;
  const text = await artifact.text();
}
