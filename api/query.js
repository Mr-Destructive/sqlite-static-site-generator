import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";

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
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "site.db");
const WASM_PATH = path.join(ROOT, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const DB_BUFFER = fs.readFileSync(DB_PATH);

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

async function withDatabase(callback) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(new Uint8Array(DB_BUFFER));
  try {
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
        rows.push(columns.map((column) => (Object.prototype.hasOwnProperty.call(rowObj, column) ? rowObj[column] : null)));
      }
      stmt.free();
      return { columns, rows };
    });
    return json(res, 200, result);
  } catch (err) {
    return json(res, 500, { error: err?.message || "Query failed" });
  }
}
