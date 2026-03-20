import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "data", "posts.json");
const WASM_PATH = path.join(ROOT, "node_modules", "sql.js", "dist", "sql-wasm.wasm");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isReadOnlySql(sql) {
  const trimmed = sql.trim().toLowerCase();
  if (trimmed === "") return false;
  if (trimmed.includes(";")) return false;
  return trimmed.startsWith("select ") || trimmed.startsWith("with ");
}

let postsData;

function loadPostsData() {
  if (!postsData) {
    if (!fs.existsSync(DATA_PATH)) {
      throw new Error("data/posts.json not found in deployment");
    }
    postsData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  }
  return postsData;
}

let sqlJsPromise;

function loadSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => {
        if (file === "sql-wasm.wasm") return WASM_PATH;
        return file;
      },
    });
  }
  return sqlJsPromise;
}

function createSchema(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      section TEXT,
      path TEXT NOT NULL UNIQUE,
      title TEXT,
      date TEXT,
      tags_json TEXT,
      meta_json TEXT,
      body_md TEXT
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(tag_id) REFERENCES tags(id)
    );`
  );
}

function populateTables(db, data) {
  const insert = db.prepare(
    "INSERT OR REPLACE INTO posts(slug, section, path, title, date, tags_json, meta_json, body_md) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags(tag) VALUES (?)");
  const insertPostTag = db.prepare("INSERT OR IGNORE INTO post_tags(post_id, tag_id) VALUES (?, ?)");

  db.exec("BEGIN");
  for (const p of data) {
    insert.run([
      p.slug,
      p.section,
      p.path,
      p.title || null,
      p.date || null,
      p.tags ? JSON.stringify(p.tags) : null,
      JSON.stringify(p.meta || {}),
      p.body_md || "",
    ]);
    if (Array.isArray(p.tags)) {
      for (const t of p.tags) {
        const tag = String(t).trim();
        if (!tag) continue;
        insertTag.run([tag]);
      }
    }
  }
  for (const p of data) {
    if (!Array.isArray(p.tags) || p.tags.length === 0) continue;
    const slug = String(p.slug).replace(/'/g, "''");
    const postIdRes = db.exec(`SELECT id FROM posts WHERE slug='${slug}'`);
    if (!postIdRes[0] || postIdRes[0].values.length === 0) continue;
    const postId = postIdRes[0].values[0][0];
    for (const t of p.tags) {
      const tag = String(t).trim().replace(/'/g, "''");
      if (!tag) continue;
      const tagIdRes = db.exec(`SELECT id FROM tags WHERE tag='${tag}'`);
      if (!tagIdRes[0] || tagIdRes[0].values.length === 0) continue;
      const tagId = tagIdRes[0].values[0][0];
      insertPostTag.run([postId, tagId]);
    }
  }
  db.exec("COMMIT");
  insert.free();
  insertTag.free();
  insertPostTag.free();
}

async function withDatabase(callback) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  try {
    createSchema(db);
    populateTables(db, loadPostsData());
    return await callback(db);
  } finally {
    db.close();
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  let sql = "";
  let args = [];

  if (req.method === "GET") {
    const u = new URL(req.url, `http://${req.headers.host}`);
    sql = u.searchParams.get("sql") || "";
    const argsParam = u.searchParams.get("args");
    if (argsParam) {
      try {
        args = JSON.parse(argsParam);
      } catch {
        return json(res, 400, { error: "Invalid args JSON" });
      }
    }
  } else {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      sql = body.sql || "";
      args = Array.isArray(body.args) ? body.args : [];
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }
  }

  if (!isReadOnlySql(sql)) {
    return json(res, 400, { error: "Only single-statement SELECT/CTE queries are allowed" });
  }

  try {
    const result = await withDatabase((db) => {
      const stmt = db.prepare(sql);
      const columns = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) {
        const rowObj = stmt.getAsObject();
        rows.push(
          columns.map((column) => (Object.prototype.hasOwnProperty.call(rowObj, column) ? rowObj[column] : null))
        );
      }
      stmt.free();
      return { columns, rows };
    });
    return json(res, 200, result);
  } catch (err) {
    return json(res, 500, { error: err?.message || "Query failed" });
  }
}
