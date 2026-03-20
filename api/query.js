import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "site.db");
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return db;
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

  const database = getDb();
  try {
    const stmt = database.prepare(sql);
    const columns = stmt.columns().map((col) => col.name);
    const rows = stmt.all(...args).map((row) =>
      columns.map((column) => (row?.[column] ?? null))
    );
    return json(res, 200, { columns, rows });
  } catch (err) {
    return json(res, 500, { error: err?.message || "Query failed" });
  }
}
