package main

import "testing"

func TestRssContentByLink(t *testing.T) {
	raw := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Techstructive Weekly #88</title>
      <link>https://www.meetgor.com/newsletter/techstructive-weekly-88</link>
      <description>Short excerpt</description>
      <content>Full newsletter body</content>
    </item>
  </channel>
</rss>`)

	content := rssContentByLink(raw)
	got, ok := content["https://www.meetgor.com/newsletter/techstructive-weekly-88"]
	if !ok {
		t.Fatalf("expected content for newsletter link")
	}
	if got != "Full newsletter body" {
		t.Fatalf("content = %q, want %q", got, "Full newsletter body")
	}
}
