package main

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func main() {
	dbURL := os.Getenv("TURSO_DB_URL")
	token := os.Getenv("TURSO_AUTH_TOKEN")
	if token == "" {
		token = os.Getenv("TURSO_DB_AUTH_TOKEN")
	}
	if dbURL == "" || token == "" {
		fmt.Println("missing TURSO_DB_URL or TURSO_AUTH_TOKEN/TURSO_DB_AUTH_TOKEN")
		os.Exit(1)
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
		panic(err)
	}
	defer db.Close()

	fmt.Println("Tables:")
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
	if err != nil {
		panic(err)
	}
	for rows.Next() {
		var name string
		rows.Scan(&name)
		fmt.Println("-", name)
	}
	rows.Close()

	fmt.Println("\nColumns for posts (if exists):")
	cols, err := db.Query("PRAGMA table_info(posts)")
	if err == nil {
		for cols.Next() {
			var cid int
			var name, ctype string
			var notnull int
			var dflt sql.NullString
			var pk int
			cols.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk)
			fmt.Printf("- %s (%s)\n", name, ctype)
		}
		cols.Close()
	}

	fmt.Println("\nSample rows from posts:")
	sample, err := db.Query("SELECT * FROM posts LIMIT 3")
	if err != nil {
		fmt.Println("posts table not found or query failed:", err)
		return
	}
	colsNames, _ := sample.Columns()
	fmt.Println(strings.Join(colsNames, " | "))
	vals := make([]interface{}, len(colsNames))
	ptrs := make([]interface{}, len(colsNames))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	for sample.Next() {
		sample.Scan(ptrs...)
		parts := make([]string, len(vals))
		for i, v := range vals {
			if v == nil {
				parts[i] = "NULL"
				continue
			}
			parts[i] = fmt.Sprintf("%v", v)
		}
		fmt.Println(strings.Join(parts, " | "))
	}
	_ = sample.Close()
}
