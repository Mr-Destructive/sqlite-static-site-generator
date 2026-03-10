# s3g shell docs

This project gives you a browser‑based SQLite shell over your blog data, plus a shareable render workflow.

## What you can do

- Query posts as SQL tables (`posts`, `tags`, `post_tags`)
- Generate a shareable render link from query results
- Export results as CSV/JSON/SQL
- Load your own SQL or `posts.json`
- Create ad‑hoc tables (including FTS) and run full‑text search

## Open the shell

```bash
cd /home/meet/code/projects/git/sqlite-markdown
python3 -m http.server 8000
```

Open:

```
http://localhost:8000/db/
```

## Core tables

```sql
.tables
.schema posts
```

Tables:
- `posts`
- `tags`
- `post_tags`

## Query examples

### Latest posts

```sql
SELECT slug, title, date, section
FROM posts
ORDER BY date DESC
LIMIT 10;
```

### Count by section

```sql
SELECT section, COUNT(*) AS count
FROM posts
GROUP BY section
ORDER BY count DESC;
```

### Find a post by slug

```sql
SELECT title, date, body_md
FROM posts
WHERE slug = 'projects/palm_go_sdk'
LIMIT 1;
```

### Search by title (simple)

```sql
SELECT slug, title
FROM posts
WHERE title LIKE '%sqlite%'
LIMIT 10;
```

### Tags (relational)

```sql
SELECT p.slug, p.title, t.tag
FROM posts p
JOIN post_tags pt ON pt.post_id = p.id
JOIN tags t ON t.id = pt.tag_id
WHERE t.tag = 'sql'
LIMIT 10;
```

## Render + share (stateless)

1. Run any query that returns `slug`, `title`, and/or `body_md`.
2. Click **Share Render**.
3. A URL is copied. Open it to view the rendered HTML.

If your query doesn’t include `body_md`, the shell will auto‑hydrate it by `slug`.

## Dot commands (all supported)

```sql
.help [command]
.tables [pattern]
.indexes [table]
.schema [pattern]
.fullschema
.databases
.read [path]
.reset
.mode [table|column|list|line|csv|json]
.headers [on|off]
.separator [text]
.nullvalue [text]
.prompt [main] [continue]
.print [text]
.echo [on|off]
.explain [on|off|full]
.timer [on|off]
.changes [on|off]
.output [filename]
.once [filename]
.stats
.version
.log [filename|off]
.clear
.quiet [on|off]
.share [--open]
.show
.dump [table]
.import FILE TABLE
```

Unsupported in browser: `.open`, `.save`, `.backup`, `.restore`, `.shell`, etc.

## Export results

### CSV

```sql
.mode csv
.headers on
SELECT title, date FROM posts LIMIT 5;
```

### SQL dump

```sql
.once dump.sql
.dump
```

## Render from SQL result

Use any query that returns `body_md` or `slug`:

```sql
SELECT slug, title
FROM posts
WHERE section = 'links'
LIMIT 5;
```

Then click **Share Render**.

## Full‑text search (FTS4)

There is no prebuilt FTS table, but you can create one in the session:

```sql
CREATE VIRTUAL TABLE posts_fts USING fts4(title, body);
INSERT INTO posts_fts(rowid, title, body)
  SELECT id, title, body_md FROM posts;
```

Search:

```sql
SELECT p.slug, p.title
FROM posts_fts f
JOIN posts p ON p.id = f.rowid
WHERE posts_fts MATCH 'sqlite';
```

Note: this is in‑memory for the session unless you export it.
