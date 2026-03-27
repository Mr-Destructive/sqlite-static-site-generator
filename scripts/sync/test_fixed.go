package main

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mmcdole/gofeed"
)

func testSiteRSS() {
	client := &http.Client{Timeout: 20 * time.Second}

	url := "https://www.meetgor.com/all-content/rss.xml"

	fmt.Printf("Trying: %s\n", url)

	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	b, _ := io.ReadAll(resp.Body)
	fmt.Printf("  Status: %d\n", resp.StatusCode)

	if resp.StatusCode != 200 {
		return
	}

	parser := gofeed.NewParser()
	feed, err := parser.ParseString(string(b))
	if err != nil {
		fmt.Printf("  Parse error: %v\n", err)
		return
	}
	fmt.Printf("  SUCCESS! Got %d items\n\n", len(feed.Items))
}
