## Usage

```yml
# action.yml
name: Hello world!
description: 👋 Greet someone and record the time

inputs:
  name:
    description: Who to greet
    default: ${{ github.actor }}

outputs:
  time:
    description: The time we greeted you

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
      - uses: # SOMETHING
      - uses: actions/publish-action@v0.2.2
        with:
          source-tag: ${{ github.event.release.tag_name }}
```

```yml
# action.yml
name: Hello world!
description: 👋 Greet someone and record the time

inputs:
  name:
    description: Who to greet
    default: ${{ github.actor }}

outputs:
  time:
    description: The time we greeted you

runs:
  using: bun1
  main: dist/main.js
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
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - uses: jcbhmr/configure-bun-action@v1
      - uses: actions4git/add-commit-push@v1
        with:
          add-force: true
      - uses: actions/publish-action@v0.2.2
        with:
          source-tag: ${{ github.event.release.tag_name }}
```

### Limitations

- There's a ~50ms startup delay from the Node.js wrapper. This is required since
  we are using Node.js as our native runtime layer.

When using the recommended `on: release` post-release build workflow, there's
also these caveats:

- The "Generate release notes" button on the GitHub release web UI doesn't
  accurately generate a diff link. This is due to the commit the tag points to
  being off the `main` branch.

## How it works

When this configurator action runs, it essentially does the following:

1. **Clone the code from `templates/.bun` into the `./bun` folder** which
   provides the wrapper `main.mjs` Node.js script which then runs
   `bun /path/to/out/main.js`. This includes `pre.mjs` and `post.mjs` too if
   you're using `pre` and/or `post` hooks.

2. **Download as many copies of Bun as needed** to support as many platforms are
   required. By default we do Linux x64, Linux ARM64, macOS x64, and macOS
   ARM64. There are currently no Bun builds for Windows, so we don't support
   Windows x64 at this time.

## Development

**Why Node.js instead of Docker as the native runtime?**

Because Docker is slower. That's it. 🤷‍♂️

**How do I test my changes?**

The easiest way is to open a Draft Pull Request either against the upstream
repository or against your own fork's main branch and watch the GitHub Actions
do their thing.
