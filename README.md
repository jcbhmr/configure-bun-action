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
      - run: bun build --entrypoints ./index.ts --outdir ./out --target bun --splitting
      - uses: # SOMETHING
      - uses: actions/publish-action@v0.2.2
        with:
          source-tag: ${{ github.event.release.tag_name }}
```
