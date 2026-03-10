# s3g (SQLite Static Site Generator)

Tiny static site build using `sqlite3` and the `markdown` extension.
Input is Markdown, output is HTML in `public/`.

## Quickstart

```bash
make
sqlite3 site.db < docs/s3g/scripts/schema.sql
```

Register templates:

```bash
sqlite3 site.db <<'SQL'
INSERT INTO template_sources(name, path) VALUES
  ('layout', 'docs/s3g/templates/layout.html'),
  ('post',   'docs/s3g/templates/post.html')
ON CONFLICT(name) DO UPDATE SET path = excluded.path;
SQL
```

Register posts:

```bash
sqlite3 site.db <<'SQL'
INSERT INTO post_sources(src_path, out_path) VALUES
  ('posts/index.md', 'public/index.html'),
  ('posts/blog/first.md', 'public/blog/first.html')
ON CONFLICT(src_path) DO UPDATE SET out_path = excluded.out_path;
SQL
```

Build:

```bash
sqlite3 site.db < docs/s3g/scripts/build.sql
```

## Optional Metadata

Attach a JSON file per post and register it:

```bash
sqlite3 site.db <<'SQL'
INSERT INTO post_meta_sources(src_path, meta_path) VALUES
  ('posts/index.md', 'posts/index.json'),
  ('posts/blog/first.md', 'posts/blog/first.json')
ON CONFLICT(src_path) DO UPDATE SET meta_path = excluded.meta_path;
SQL
```

Example `posts/blog/first.json`:

```json
{
  "title": "First Post",
  "date": "2026-03-07",
  "description": "Short summary shown above the content."
}
```

If metadata is missing, the title falls back to the first Markdown `# Heading`.

## Search

Full-text search uses `FTS4`. The index is rebuilt during `build.sql`.

```bash
sqlite3 site.db \
  -cmd ".parameter init" \
  -cmd ".parameter set @q 'sqlite'" \
  < docs/s3g/scripts/search.sql
```

## Files That Matter

- `docs/s3g/templates/layout.html`
- `docs/s3g/templates/post.html`
- `docs/s3g/scripts/build.sql`
- `docs/s3g/scripts/schema.sql`
- `docs/s3g/scripts/load_templates.sql`
- `docs/s3g/scripts/load_posts.sql`
- `docs/s3g/scripts/render_with_templates.sql`
- `docs/s3g/scripts/search.sql`
