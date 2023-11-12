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

**🚀 Looking to get started fast? Check out the ["Hello world!" GitHub Action
using Bun] template to hit the ground running!**

To get started using Bun as your GitHub Actions runtime of choice, just add this
to your `action.yml`. Yes, it's non-standard and won't work as-is but don't
worry, we'll preprocess it with `uses: jcbhmr/configure-bun-action@v1` to
downlevel it to use the native Node.js runtime.

```yml
# action.yml
runs:
  using: bun1
  main: main.ts
```

Nice! Now you have the proper manifest. To actually publish your new GitHub
Action so that it can be used we need to preprocess it to use the native Node.js
runtime with a wrapper to run `bun main.ts`. That's exactly what this GitHub
Action does. To use it you'll need to add a post-release GitHub Actions workflow
like this to your project:

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

Look at that! Now whenever we release a new `v1.0.0` version this workflow will
run to downlevel our `using: bun1` action to `using: node20`. Then
[actions4git/add-commit-push] will update the tag to use the compiled version.
After that magic has completed, [actions/publish-action] will update the major
`v1` version tag to point to the new release.

[💡 You can use this post-release tag mutation trick for your Node.js-based GitHub Actions too!](https://github.com/jcbhmr/hello-world-nodejs-action)

Now you might be wondering how to test your action locally, right? To do that,
just make sure you run `uses: jcbhmr/configure-bun-action@v1` before you do
`uses: ./` like this:

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
  we are using Node.js as our native runtime layer.

- This GitHub Action pseudo-runtime relies on large binary files in your Git
  repository. As you create more releases you repository size may grow quite
  large. We aren't using a from-network installation because the startup time
  would skyrocket to ~5 seconds. [#3]

- Any GitHub Action created using Bun won't support Windows since **Bun doesn't
  yet provide stable builds for Windows**. [oven-sh/bun#43]

- Your GitHub Action is no longer directly usable; there's a compile step. That
  means `uses: octocat/my-action@main` doesn't work. This problem is shared with
  many Node.js-based Actions which also require a compile step.

When using the recommended `on: release` post-release build workflow, there's
also these caveats:

- There's a ~30 second window where the latest release has uncompiled code.
  **The major tags are _never_ affected**. This is **nothing to worry about**
  because _there's no way this could break anything_. The only way to see the
  uncompiled code would be to explicitly `uses: octocat/my-action@v1.2.3` (`@v1`
  is unaffected) **immediately** after v1.2.3 was released. It's not humanly
  possible to respond that fast to a new release. Even so, this is still a thing
  that is worth knowing.

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

This action **relies on _you_ to commit the result** in order to make it usable
by GitHub Actions consumers. That means doing `git add .bun`, `git commit`, and
`git push` or something similar. See the Usage section for details.

## Development

![Bun](https://img.shields.io/static/v1?style=for-the-badge&message=Bun&color=000000&logo=Bun&logoColor=FFFFFF&label=)

**Why Node.js instead of Docker as the native runtime?**

Because Docker is slower. That's it. 🤷‍♂️

**How do I test my changes?**

The easiest way is to open a Draft Pull Request either against the upstream
repository or against your own fork's main branch and watch the GitHub Actions
do their thing.

<!-- prettier-ignore-start -->
[bun]: https://bun.sh/
[auto-installing dependencies]: https://bun.sh/docs/runtime/autoimport
[oven-sh/bun#43]: https://github.com/oven-sh/bun/issues/43
[#3]: https://github.com/jcbhmr/configure-bun-action/issues/3
["Hello world!" GitHub Action using Bun]: https://github.com/jcbhmr/hello-world-bun-action
[actions4git/add-commit-push]: https://github.com/actions4git/add-commit-push
[actions/publish-action]: https://github.com/actions/publish-action
<!-- prettier-ignore-end -->
