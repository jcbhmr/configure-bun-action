#!/usr/bin/env node
import { build } from "vite";
import { writeFile } from "node:fs/promises";

console.debug(`Building configurator...`);
// https://vitejs.dev/config/
await build({
  build: {
    minify: false,
    target: "node20",
    ssr: true,
    rollupOptions: {
      input: ["src/main.ts"],
    },
  },
  ssr: {
    // Anything NOT 'node:' will be bundled.
    noExternal: /^(?!node:)/,
  },
});

console.debug(`Building runtime...`);
// https://vitejs.dev/config/
await build({
  build: {
    outDir: "dist/runtime",
    minify: false,
    target: "esnext",
    ssr: true,
    rollupOptions: {
      input: [
        "src/runtime/main.ts",
        "src/runtime/pre.ts",
        "src/runtime/post.ts",
      ],
    },
  },
  ssr: {
    // Anything NOT 'node:' will be bundled.
    noExternal: /^(?!node:)/,
  },
  plugins: [{
    name: "my-plugin",
    async closeBundle() {
      await writeFile("dist/runtime/package.json", JSON.stringify({ type: "module" }))
    }
  }]
});
