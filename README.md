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
      - uses: jcbhmr/configure-bun-action@v1
      - run: bun build --entrypoints ./index.ts --outdir ./out --target bun
          --splitting
      - uses: # SOMETHING
      - uses: actions/publish-action@v0.2.2
        with:
          source-tag: ${{ github.event.release.tag_name }}
```

### Limitations

- There's a ~50ms startup delay from the Node.js wrapper.

## How it works

There are three native GitHub Actions runtimes: Node.js (`using: node20` or
similar), Docker (`using: docker`), and composite (`using: composite`). In order
to simulate a Bun runtime (`using: bun1` or similar) we need to wrap the
`bun /path/to/main.ts` command inside one of those other runtimes. The Node.js
runtime provides the most similar experience to the one we want to provide for
the Bun runtime, so we'll wrap our Bun runtime inside the Node.js v20 runtime
`using: node20`.

When this configurator action runs, it essentially does the following:

1. **Download as many copies of Bun as needed** to support as many platforms are
   required. By default we do Linux x64, Linux ARM64, macOS x64, and macOS
   ARM64. There are currently no Bun builds for Windows, so we don't support
   Windows x64 at this time.

2. \*\*Instantiate the wrapper
