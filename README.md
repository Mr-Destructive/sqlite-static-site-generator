# sqlite-markdown

SQLite extension that adds a `markdown(text)` function (CommonMark via cmark).
There’s also a tiny SQLite‑powered static site generator in `docs/s3g/`.

## Build

```bash
make
```

This produces `markdown.so`.

## Use

```bash
sqlite3 site.db -cmd ".load ./markdown" \
  "SELECT markdown('# Hello');"
```

## s3g (SQLite Static Site Generator)

If you want the static site flow, start here:

- `docs/s3g/README.md`

It walks through registering templates/posts and running `docs/s3g/scripts/build.sql`.
