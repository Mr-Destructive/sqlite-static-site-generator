# sqlite-markdown

SQLite extension that adds a `markdown(text)` function (CommonMark via cmark).
There’s also a tiny SQLite‑powered static site generator in `docs/s3g/`.

## Build (Step by Step)

1. Build the extension:

```bash
make
```

2. Confirm the shared library exists:

```bash
ls -l markdown.so
```

Example output:

```text
-rwxr-xr-x  1 you  staff  123456 Mar 10 12:34 markdown.so
```

## Use (Step by Step)

1. Load the extension and render markdown:

```bash
sqlite3 site.db -cmd ".load ./markdown" \
  "SELECT markdown('# Hello');"
```

Example output:

```text
<h1>Hello</h1>
```

## Demo

### Run as commands (no SQLite prompt)

Build the extension, set up the database, register templates and posts, then build the site:

```bash
make
sqlite3 site.db < docs/s3g/scripts/schema.sql

sqlite3 site.db <<'SQL'
INSERT INTO template_sources(name, path) VALUES
  ('layout', 'docs/s3g/templates/layout.html'),
  ('post',   'docs/s3g/templates/post.html')
ON CONFLICT(name) DO UPDATE SET path = excluded.path;
SQL

sqlite3 site.db <<'SQL'
INSERT INTO post_sources(src_path, out_path) VALUES
  ('posts/index.md', 'public/index.html'),
  ('posts/blog/first.md', 'public/blog/first.html')
ON CONFLICT(src_path) DO UPDATE SET out_path = excluded.out_path;
SQL

sqlite3 site.db < docs/s3g/scripts/build.sql
```

Check what got generated:

```bash
ls public
```

Example output:

```text
blog
index.html
site-index.html
```

### Run inside SQLite

Open SQLite:

```bash
sqlite3 site.db
```

```sql
.read docs/s3g/scripts/schema.sql
.load ./markdown

-- Save where the HTML templates live.
INSERT INTO template_sources(name, path) VALUES
  ('layout', 'docs/s3g/templates/layout.html'),
  ('post',   'docs/s3g/templates/post.html')
ON CONFLICT(name) DO UPDATE SET path = excluded.path;

-- Save which Markdown files become which HTML files.
INSERT INTO post_sources(src_path, out_path) VALUES
  ('posts/index.md', 'public/index.html'),
  ('posts/blog/first.md', 'public/blog/first.html')
ON CONFLICT(src_path) DO UPDATE SET out_path = excluded.out_path;

-- Build the site into public/.
.read docs/s3g/scripts/build.sql
```

Expected files:

```text
public/index.html
public/blog/first.html
public/site-index.html
```

## s3g (SQLite Static Site Generator)

Use this if you want SQLite to build static HTML from `posts/` into `public/`.

1. Initialize tables:

```bash
sqlite3 site.db < docs/s3g/scripts/schema.sql
```

2. Register templates:

```bash
sqlite3 site.db <<'SQL'
INSERT INTO template_sources(name, path) VALUES
  ('layout', 'docs/s3g/templates/layout.html'),
  ('post',   'docs/s3g/templates/post.html')
ON CONFLICT(name) DO UPDATE SET path = excluded.path;
SQL
```

3. Register posts:

```bash
sqlite3 site.db <<'SQL'
INSERT INTO post_sources(src_path, out_path) VALUES
  ('posts/index.md', 'public/index.html'),
  ('posts/blog/first.md', 'public/blog/first.html')
ON CONFLICT(src_path) DO UPDATE SET out_path = excluded.out_path;
SQL
```

4. Build:

```bash
sqlite3 site.db < docs/s3g/scripts/build.sql
```

Example output files:

```text
public/index.html
public/blog/first.html
public/site-index.html
```

Full details live in `docs/s3g/README.md`.

## Browser SQLite Shell

There is a tiny browser shell at the repo root that loads the posts into SQLite (WASM) so you can query them as a table.
Open `index.html` in a static server and run SQL against the `posts` table.
