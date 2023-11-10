## Usage

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
      - uses: jcbhmr/update-release@v1
      - uses: actions/publish-action@v0.2.2
        with:
          source-tag: ${{ github.event.release.tag_name }}
```

### Limitations

- You need an internet connection to fetch the latest available version of Bun. This can take time or fail completely.

- You need to actually _use this jcbhmr/configure-bun-action action_ and it's not as simple as native Node.js. Then again, Node.js still often requires a bundling step so it's your choice where to put the complexity.
