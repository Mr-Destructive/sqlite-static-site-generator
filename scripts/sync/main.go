package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

type Post struct {
	Slug    string                 `json:"slug"`
	Section string                 `json:"section"`
	Path    string                 `json:"path"`
	Title   string                 `json:"title"`
	Date    string                 `json:"date"`
	Tags    []string               `json:"tags"`
	Meta    map[string]interface{} `json:"meta"`
	BodyMD  string                 `json:"body_md"`
	Source  string                 `json:"source"`
}

func main() {
	var (
		withNewsletter = flag.Bool("newsletter", false, "sync newsletter RSS")
		lookbackHours  = flag.Int("since-hours", 24, "lookback window in hours (optional)")
	)
	flag.Parse()

	cwd, _ := os.Getwd()
	repoRoot := findRepoRoot(cwd)
	postsDir := filepath.Join(repoRoot, "db", "posts")
	dataDir := filepath.Join(repoRoot, "db", "data")

	if err := os.MkdirAll(postsDir, 0o755); err != nil {
		die(err)
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		die(err)
	}

	dbURL := os.Getenv("TURSO_DB_URL")
	token := os.Getenv("TURSO_AUTH_TOKEN")
	query := os.Getenv("TURSO_POSTS_QUERY")
	if query == "" {
		query = "SELECT slug, title, content, excerpt, tags, metadata, type_id, created_at, updated_at, published_at, status FROM posts WHERE status='published' AND (updated_at >= ? OR created_at >= ?)"
	}
	if dbURL == "" || token == "" {
		die(fmt.Errorf("missing TURSO_DB_URL or TURSO_AUTH_TOKEN"))
	}
	if !strings.Contains(dbURL, "authToken=") {
		sep := "?"
		if strings.Contains(dbURL, "?") {
			sep = "&"
		}
		dbURL = dbURL + sep + "authToken=" + token
	}

	db, err := sql.Open("libsql", dbURL)
	if err != nil {
		die(err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	sinceTime := time.Now().Add(-time.Duration(*lookbackHours) * time.Hour)
	var rows *sql.Rows
	if strings.Contains(query, "?") {
		rows, err = db.QueryContext(ctx, query, sinceTime, sinceTime)
	} else {
		rows, err = db.QueryContext(ctx, query)
	}
	if err != nil {
		die(err)
	}
	defer rows.Close()

	posts := []Post{}

	for rows.Next() {
		var slug, title, content, excerpt, tagsJSON, metaJSON, typeID, createdAt, updatedAt, publishedAt, status sql.NullString
		if err := rows.Scan(&slug, &title, &content, &excerpt, &tagsJSON, &metaJSON, &typeID, &createdAt, &updatedAt, &publishedAt, &status); err != nil {
			die(err)
		}

		post := Post{
			Slug:    slug.String,
			Section: typeID.String,
			Title:   title.String,
			Date:    pickDate(publishedAt.String, createdAt.String, updatedAt.String),
			BodyMD:  content.String,
			Meta:    map[string]interface{}{},
			Source:  "turso",
		}

		if tagsJSON.Valid {
			_ = json.Unmarshal([]byte(tagsJSON.String), &post.Tags)
		}
		if metaJSON.Valid {
			_ = json.Unmarshal([]byte(metaJSON.String), &post.Meta)
		}
		if excerpt.Valid && excerpt.String != "" {
			post.Meta["excerpt"] = excerpt.String
		}
		if status.Valid && status.String != "" {
			post.Meta["status"] = status.String
		}

		if post.Section == "" {
			post.Section = "posts"
		}

		if post.Slug == "" {
			post.Slug = slugFromTitle(post.Title)
		}

		post.Path = buildPath(post.Section, post.Slug)
		posts = append(posts, post)
	}
	if err := rows.Err(); err != nil {
		die(err)
	}

	if *withNewsletter {
		rssURL := os.Getenv("NEWSLETTER_RSS_URL")
		if rssURL == "" {
			rssURL = "https://techstructively.substack.com/feed"
		}
		nPosts, err := fetchNewsletter(rssURL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "newsletter sync skipped: %v\n", err)
		} else {
			posts = append(posts, nPosts...)
		}
	}

	// overwrite db/posts
	if err := os.RemoveAll(postsDir); err != nil {
		die(err)
	}
	if err := os.MkdirAll(postsDir, 0o755); err != nil {
		die(err)
	}

	for _, p := range posts {
		path := filepath.Join(postsDir, filepath.FromSlash(p.Path))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			die(err)
		}
		if err := os.WriteFile(path, []byte(p.BodyMD+"\n"), 0o644); err != nil {
			die(err)
		}
		meta := map[string]interface{}{}
		for k, v := range p.Meta {
			meta[k] = v
		}
		if p.Title != "" {
			meta["title"] = p.Title
		}
		if p.Date != "" {
			meta["date"] = p.Date
		}
		if len(p.Tags) > 0 {
			meta["tags"] = p.Tags
		}
		meta["section"] = p.Section
		meta["source"] = p.Source

		metaPath := strings.TrimSuffix(path, filepath.Ext(path)) + ".json"
		b, _ := json.MarshalIndent(meta, "", "  ")
		if err := os.WriteFile(metaPath, append(b, '\n'), 0o644); err != nil {
			die(err)
		}
	}

	postsJSONPath := filepath.Join(dataDir, "posts.json")
	seedSQLPath := filepath.Join(dataDir, "seed.sql")

	if err := writePostsJSON(postsJSONPath, posts); err != nil {
		die(err)
	}
	if err := writeSeedSQL(seedSQLPath, posts); err != nil {
		die(err)
	}

	fmt.Printf("Synced %d posts\n", len(posts))
}

func findRepoRoot(start string) string {
	if env := os.Getenv("REPO_ROOT"); env != "" {
		return env
	}
	dir := start
	for {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return start
		}
		dir = parent
	}
}

func writePostsJSON(path string, posts []Post) error {
	b, err := json.MarshalIndent(posts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(b, '\n'), 0o644)
}

func writeSeedSQL(path string, posts []Post) error {
	var sb strings.Builder
	sb.WriteString("PRAGMA journal_mode = OFF;\nPRAGMA synchronous = OFF;\n\n")
	sb.WriteString("CREATE TABLE IF NOT EXISTS posts (\n  id INTEGER PRIMARY KEY,\n  slug TEXT NOT NULL UNIQUE,\n  section TEXT,\n  path TEXT NOT NULL UNIQUE,\n  title TEXT,\n  date TEXT,\n  tags_json TEXT,\n  meta_json TEXT,\n  body_md TEXT\n);\n\n")
	sb.WriteString("CREATE TABLE IF NOT EXISTS tags (\n  id INTEGER PRIMARY KEY,\n  tag TEXT NOT NULL UNIQUE\n);\n\n")
	sb.WriteString("CREATE TABLE IF NOT EXISTS post_tags (\n  post_id INTEGER NOT NULL,\n  tag_id INTEGER NOT NULL,\n  PRIMARY KEY (post_id, tag_id),\n  FOREIGN KEY(post_id) REFERENCES posts(id),\n  FOREIGN KEY(tag_id) REFERENCES tags(id)\n);\n\n")
	sb.WriteString("DELETE FROM post_tags;\nDELETE FROM tags;\nDELETE FROM posts;\n\n")

	tagIDs := map[string]int{}
	nextTagID := 1
	for _, p := range posts {
		tagsJSON, _ := json.Marshal(p.Tags)
		metaJSON, _ := json.Marshal(p.Meta)
		sb.WriteString("INSERT INTO posts(slug, section, path, title, date, tags_json, meta_json, body_md) VALUES (")
		sb.WriteString(csvSQL(p.Slug) + ", ")
		sb.WriteString(csvSQL(p.Section) + ", ")
		sb.WriteString(csvSQL(p.Path) + ", ")
		sb.WriteString(csvSQL(p.Title) + ", ")
		sb.WriteString(csvSQL(p.Date) + ", ")
		sb.WriteString(csvSQL(string(tagsJSON)) + ", ")
		sb.WriteString(csvSQL(string(metaJSON)) + ", ")
		sb.WriteString(csvSQL(p.BodyMD) + ");\n")

		for _, t := range p.Tags {
			id, ok := tagIDs[t]
			if !ok {
				id = nextTagID
				tagIDs[t] = id
				nextTagID++
				sb.WriteString(fmt.Sprintf("INSERT INTO tags(id, tag) VALUES (%d, %s);\n", id, csvSQL(t)))
			}
			sb.WriteString(fmt.Sprintf("INSERT INTO post_tags(post_id, tag_id) VALUES ((SELECT id FROM posts WHERE slug=%s), %d);\n", csvSQL(p.Slug), id))
		}
	}

	return os.WriteFile(path, []byte(sb.String()), 0o644)
}

func csvSQL(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

func buildPath(section, slug string) string {
	slug = strings.Trim(slug, "/")
	if strings.Contains(slug, "/") {
		return slug + ".md"
	}
	if section == "" {
		section = "posts"
	}
	return section + "/" + slug + ".md"
}

func slugFromTitle(title string) string {
	re := regexp.MustCompile(`[^a-z0-9]+`)
	s := strings.ToLower(title)
	s = re.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "post"
	}
	return s
}

func parseDate(s string) (time.Time, error) {
	formats := []string{time.RFC3339, time.RFC1123Z, time.RFC1123, "2006-01-02"}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unknown date format")
}

func pickDate(publishedAt, createdAt, updatedAt string) string {
	if publishedAt != "" {
		if t, err := parseDate(publishedAt); err == nil {
			return t.Format("2006-01-02")
		}
	}
	if createdAt != "" {
		if t, err := parseDate(createdAt); err == nil {
			return t.Format("2006-01-02")
		}
	}
	if updatedAt != "" {
		if t, err := parseDate(updatedAt); err == nil {
			return t.Format("2006-01-02")
		}
	}
	return ""
}

func fetchNewsletter(url string) ([]Post, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	tryFetch := func(feedURL string) (*gofeed.Feed, string, error) {
		req, err := http.NewRequest(http.MethodGet, feedURL, nil)
		if err != nil {
			return nil, "", fmt.Errorf("%s: %w", feedURL, err)
		}
		req.Header.Set("User-Agent", "sqlite-static-site-generator/1.0")
		req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1")
		resp, err := client.Do(req)
		if err != nil {
			return nil, "", fmt.Errorf("%s: %w", feedURL, err)
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, resp.Status, fmt.Errorf("%s: newsletter feed returned status %s", feedURL, resp.Status)
		}
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, resp.Status, fmt.Errorf("%s: %w", feedURL, err)
		}
		parser := gofeed.NewParser()
		contentType := resp.Header.Get("Content-Type")
		feed, err := parser.ParseString(string(b))
		if err != nil {
			return nil, resp.Status, fmt.Errorf("%s: failed to parse feed (content-type %q): %w", feedURL, contentType, err)
		}
		return feed, resp.Status, nil
	}

	feed, status, err := tryFetch(url)
	if err != nil {
		// Substack is often blocked from CI. Try multiple fallbacks for any non-2xx.
		if strings.Contains(url, "substack.com/") {
			blog := strings.TrimSuffix(strings.TrimPrefix(strings.TrimPrefix(url, "https://"), "http://"), "/feed")
			parts := strings.Split(blog, ".")
			substackName := parts[0]
			fallbacks := []string{
				"https://rsshub.app/substack/blog/" + substackName,
				"https://r.jina.ai/http://" + strings.TrimPrefix(strings.TrimPrefix(url, "https://"), "http://"),
			}
			errs := []string{err.Error()}
			_ = status
			for _, fb := range fallbacks {
				feed, _, err = tryFetch(fb)
				if err == nil {
					break
				}
				errs = append(errs, err.Error())
			}
			if err != nil {
				return nil, fmt.Errorf("all newsletter feed attempts failed: %s", strings.Join(errs, " | "))
			}
		} else {
			return nil, err
		}
	}

	posts := []Post{}
	for _, item := range feed.Items {
		date := ""
		if item.PublishedParsed != nil {
			date = item.PublishedParsed.Format("2006-01-02")
		}
		body := item.Content
		if body == "" {
			body = item.Description
		}
		slug := slugFromTitle(item.Title)
		posts = append(posts, Post{
			Slug:    "newsletter/" + slug,
			Section: "newsletter",
			Path:    "newsletter/" + slug + ".md",
			Title:   item.Title,
			Date:    date,
			Tags:    []string{"newsletter"},
			Meta: map[string]interface{}{
				"link":   item.Link,
				"source": "substack",
			},
			BodyMD: body,
			Source: "substack",
		})
	}
	return posts, nil
}

func die(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
