package main

import (
	"fmt"
	"io"
	"net/http"
	"time"
)

func probeSiteRSSSimple() {
	client := &http.Client{Timeout: 20 * time.Second}
	url := "https://www.meetgor.com/all-content/rss.xml"

	fmt.Printf("Trying: %s\n", url)

	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, _ := client.Do(req)
	defer resp.Body.Close()

	io.ReadAll(resp.Body)
	fmt.Printf("  Status: %d\n\n", resp.StatusCode)
}
