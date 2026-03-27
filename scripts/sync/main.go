package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
		rssURL = flag.String("rss-url", "", "RSS feed URL to sync")
	)
	flag.Parse()

	cwd, _ := os.Getwd()
	repoRoot := findRepoRoot(cwd)
	dataDir := filepath.Join(repoRoot, "data")

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		die(err)
	}

	if *rssURL == "" {
		*rssURL = "https://www.meetgor.com/rss.xml"
	}

	posts, err := fetchSiteRSS(*rssURL)
	if err != nil {
		die(err)
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

func fetchSiteRSS(rssURL string) ([]Post, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	req, err := http.NewRequest(http.MethodGet, rssURL, nil)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", rssURL, err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Referer", "https://www.google.com/")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", rssURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%s: feed returned status %s", rssURL, resp.Status)
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", rssURL, err)
	}
	parser := gofeed.NewParser()
	contentType := resp.Header.Get("Content-Type")
	feed, err := parser.ParseString(string(b))
	if err != nil {
		return nil, fmt.Errorf("%s: failed to parse feed (content-type %q): %w", rssURL, contentType, err)
	}
	return parseFeedPosts(feed)
}

func parseFeedPosts(feed *gofeed.Feed) ([]Post, error) {
	posts := []Post{}
	seen := map[string]struct{}{}

	for _, item := range feed.Items {
		post, ok := parseFeedItem(item)
		if !ok {
			continue
		}
		if _, exists := seen[post.Path]; exists {
			continue
		}
		seen[post.Path] = struct{}{}
		posts = append(posts, post)
	}
	return posts, nil
}

func parseFeedItem(item *gofeed.Item) (Post, bool) {
	if item == nil || item.Link == "" {
		return Post{}, false
	}

	u, err := url.Parse(item.Link)
	if err != nil {
		return Post{}, false
	}

	path := strings.Trim(u.Path, "/")
	if path == "" {
		return Post{}, false
	}

	parts := strings.Split(path, "/")
	section := "posts"
	slug := path
	if len(parts) > 1 {
		section = parts[0]
		slug = strings.Join(parts[1:], "/")
	}

	if section == "" {
		section = "posts"
	}
	if slug == "" {
		slug = slugFromTitle(item.Title)
	}

	date := ""
	if item.PublishedParsed != nil {
		date = item.PublishedParsed.Format("2006-01-02")
	}
	body := item.Content
	if body == "" {
		body = item.Description
	}

	tags := make([]string, 0, len(item.Categories))
	for _, cat := range item.Categories {
		tag := strings.TrimSpace(cat)
		if tag != "" {
			tags = append(tags, tag)
		}
	}

	meta := map[string]interface{}{
		"link":   item.Link,
		"source": "rss",
	}
	if item.Description != "" {
		meta["excerpt"] = item.Description
	}

	return Post{
		Slug:    slug,
		Section: section,
		Path:    buildPath(section, slug),
		Title:   item.Title,
		Date:    date,
		Tags:    tags,
		Meta:    meta,
		BodyMD:  body,
		Source:  "rss",
	}, true
}

func die(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
