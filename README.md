# Configure Bun action

🧅 Write your GitHub Actions using [Bun]!

<table align=center><td colspan=2>

```ts
// main.ts
import * as core from "@actions/core";
console.log(`Hello ${core.getInput("name")}!`);
core.setOutput("time", new Date().toLocaleTimeString());
```

<tr><td>

```yml
# action.yml
runs:
  using: bun1
  main: main.ts
```

<td>

```yml
# .github/workflows/publish-action.yml
- uses: jcbhmr/configure-bun-action@v1
- uses: actions4git/add-commit-push@v1
```

</table>

🧅 Uses [Bun], not Node.js to run your JavaScript (or TypeScript) \
📦 Embeds the `bun` binary in your GitHub Action \
🌯 Uses the native Node.js runtime to spawn `bun /path/to/main.ts` \
🧙‍♂️ Bun supports [auto-installing dependencies]

## Usage

![Bun](https://img.shields.io/static/v1?style=for-the-badge&message=Bun&color=000000&logo=Bun&logoColor=FFFFFF&label=)
![GitHub Actions](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub+Actions&color=2088FF&logo=GitHub+Actions&logoColor=FFFFFF&label=)

```yml
# action.yml
runs:
  using: bun1
  main: main.ts
```

```yml
# .github/workflows/publish-action.yml
name: publish-action
on:
  release:
    types: released
jobs:
  publish-action:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jcbhmr/configure-bun-action@v1
      - uses: actions4git/add-commit-push@v1
      - uses: actions/publish-action@v0.2.2
        with:
          source-tag: ${{ github.event.release.tag_name }}
```

[💡 You can use this post-release tag mutation trick for your Node.js-based GitHub Actions too!](https://github.com/jcbhmr/hello-world-nodejs-action)

```yml
# .github/workflows/test-action.yml
name: Test action
on:
  push:
    branches: "main"
  pull_request:
jobs:
  test-action:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jcbhmr/configure-bun-action@v1
      - uses: ./
```

### Caveats

- There's a ~50ms startup delay from the Node.js wrapper. This is required since
  we are using Node.js as our native runtime layer. This is **much much faster
  than doing a from-network installation** which is the primary alternative.

- This GitHub Action pseudo-runtime relies on large binary files in your Git
  repository. As you create more releases you repository size may grow quite
  large. [#3]

- Any GitHub Action created using Bun won't support Windows since **Bun doesn't
  yet provide stable builds for Windows**. [oven-sh/bun#43]

When using the recommended `on: release` post-release build workflow, there's
also these caveats:

- The <kbd>Generate release notes</kbd> button on the GitHub release web UI
  doesn't accurately generate a diff link. This is due to tag's commit not being
  present on the default branch.

## How it works

When this configurator action runs, it essentially does the following:

1. **Clone the code from `templates/.bun` into the `./bun` folder** which
   provides the wrapper `main.mjs` Node.js script which then runs
   `bun /path/to/main.ts`. This includes `pre.mjs` and `post.mjs` too if you're
   using `pre` and/or `post` hooks.

2. **Download as many copies of Bun as needed** to support as many platforms are
   required. By default we do Linux x64, Linux ARM64, macOS x64, and macOS
   ARM64. There are currently no Bun builds for Windows, so **we don't support
   Windows x64** at this time.

3. **Rely on _you_ to commit the result** in order to make it usable by GitHub
   Actions consumers. That means doing `git add .bun`, `git commit`, and
   `git push` or something similar. See the Usage section for more information.

## Development

![Bun](https://img.shields.io/static/v1?style=for-the-badge&message=Bun&color=000000&logo=Bun&logoColor=FFFFFF&label=)

**Why Node.js instead of Docker as the native runtime?**

Because Docker is slower. That's it. 🤷‍♂️

**How do I test my changes?**

The easiest way is to open a Draft Pull Request either against the upstream
repository or against your own fork's main branch and watch the GitHub Actions
do their thing.

[bun]: https://bun.sh/
[auto-installing dependencies]: https://bun.sh/docs/runtime/autoimport
[oven-sh/bun#43]: https://github.com/oven-sh/bun/issues/43
[#3]: https://github.com/jcbhmr/configure-bun-action/issues/3
