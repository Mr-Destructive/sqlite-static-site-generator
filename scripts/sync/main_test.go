package main

import "testing"

func TestDefaultRSSURL(t *testing.T) {
	if defaultRSSURL != "https://www.meetgor.com/all-content/rss.xml" {
		t.Fatalf("defaultRSSURL = %q, want %q", defaultRSSURL, "https://www.meetgor.com/all-content/rss.xml")
	}
}
