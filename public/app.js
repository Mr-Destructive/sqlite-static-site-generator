const screenEl = document.getElementById('screen');
const inputEl = document.getElementById('sql-input');
const promptLabelEl = document.querySelector('.prompt-label');

const history = [];
let historyIndex = -1;
let buffer = '';
let outputMode = 'table';
let showHeaders = true;
let separator = '|';
let nullValue = 'NULL';
let echoOn = false;
let timerOn = false;
let changesOn = false;
let quietOn = false;
let outputFile = null;
let outputOnce = null;
let outputBuffer = [];
let logFile = null;
let logBuffer = [];
let explainMode = 'off'; // off | query | full
let promptMain = 'sqlite>';
let promptContinue = '   ...>';
let lastResult = null;
let lastSqlText = '';
let lastError = '';
let lastRunMs = null;
let lastRows = null;
let lastShareUrl = '';
const dotCommands = [
  '.help','.tables','.indexes','.schema','.fullschema','.databases','.read','.reset',
  '.mode','.headers','.separator','.nullvalue','.prompt','.print','.echo','.explain',
  '.timer','.changes','.output','.once','.stats','.version','.log','.show',
  '.dump','.import','.clear'
];
const sqlKeywords = [
  'SELECT','FROM','WHERE','LIMIT','ORDER','BY','GROUP','HAVING','JOIN','LEFT','RIGHT',
  'INNER','OUTER','ON','AS','INSERT','INTO','VALUES','UPDATE','SET','DELETE',
  'CREATE','TABLE','INDEX','VIEW','DROP','ALTER','PRIMARY','KEY','FOREIGN',
  'NOT','NULL','UNIQUE','DISTINCT','AND','OR','IN','IS','LIKE','BETWEEN',
  'UNION','ALL','CASE','WHEN','THEN','ELSE','END','DESC','ASC'
];

const unsupportedCommands = new Set([
  '.archive', '.auth', '.backup', '.bail', '.cd', '.check', '.clone',
  '.connection', '.crlf', '.dbconfig', '.dbinfo', '.dbtotxt', '.dump',
  '.eqp', '.excel', '.expert', '.explain', '.filectrl', '.fullschema',
  '.imposter', '.intck', '.limit', '.lint', '.load', '.log', '.nonce',
  '.open', '.parameter', '.progress', '.recover', '.restore', '.save',
  '.scanstats', '.session', '.sha3sum', '.shell', '.stats', '.system',
  '.timeout', '.trace', '.unmodule', '.version'
]);

function writeLine(text = '', force = false) {
  if (quietOn && !force) return;
  if (logFile) logBuffer.push(text);
  if (outputFile || outputOnce) {
    outputBuffer.push(text);
    return;
  }
  screenEl.textContent += `${text}\n`;
  screenEl.scrollTop = screenEl.scrollHeight;
}

function shellMsg(text) {
  writeLine(`shell> ${text}`, true);
}

function setStatus(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateStatus() {
  if (lastRows !== null) setStatus('status-rows', String(lastRows));
  if (lastRunMs !== null) setStatus('status-time', `${lastRunMs.toFixed(1)} ms`);
  if (lastShareUrl) setStatus('status-share', 'ready');
}

function csvEscape(value) {
  if (value === null || value === undefined) return nullValue;
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/\"/g, '\"\"')}"`;
  }
  return s;
}

function printTable(result) {
  const cols = result.columns;
  const rows = result.values.map(row => row.map(v => v === null ? nullValue : String(v)));
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map(r => r[i]?.length || 0)));
  const line = (cells) => cells.map((c, i) => (c || '').padEnd(widths[i])).join(' | ');
  if (showHeaders) {
    writeLine(line(cols));
    writeLine(widths.map(w => '-'.repeat(w)).join('-+-'));
  }
  rows.forEach(r => writeLine(line(r)));
}

function printList(result) {
  const cols = result.columns;
  const rows = result.values.map(row => row.map(v => v === null ? nullValue : String(v)));
  if (showHeaders) writeLine(cols.join(separator));
  rows.forEach(r => writeLine(r.join(separator)));
}

function printLineMode(result) {
  const cols = result.columns;
  const rows = result.values;
  rows.forEach((row, idx) => {
    writeLine(`-- row ${idx + 1} --`);
    row.forEach((val, i) => {
      const v = val === null ? nullValue : String(val);
      writeLine(`${cols[i]} = ${v}`);
    });
  });
}

function printCsv(result) {
  const cols = result.columns;
  if (showHeaders) writeLine(cols.map(csvEscape).join(','));
  result.values.forEach(row => {
    writeLine(row.map(csvEscape).join(','));
  });
}

function printJson(result) {
  const cols = result.columns;
  const rows = result.values.map(row => {
    const obj = {};
    row.forEach((val, i) => {
      obj[cols[i]] = val;
    });
    return obj;
  });
  writeLine(JSON.stringify(rows, null, 2));
}

function printResult(result) {
  if (outputMode === 'table' || outputMode === 'column') return printTable(result);
  if (outputMode === 'list') return printList(result);
  if (outputMode === 'line') return printLineMode(result);
  if (outputMode === 'csv') return printCsv(result);
  if (outputMode === 'json') return printJson(result);
  return printTable(result);
}

function splitStatements(sql) {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

function flushOutputBuffer() {
  if (!outputFile && !outputOnce) return;
  const name = outputOnce || outputFile || 'output.txt';
  const content = outputBuffer.join('\n') + '\n';
  outputBuffer = [];
  if (outputOnce) outputOnce = null;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function flushLogBuffer() {
  if (!logFile) return;
  const content = logBuffer.join('\n') + '\n';
  logBuffer = [];
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = logFile;
  a.click();
  URL.revokeObjectURL(url);
}

function clearScreen() {
  screenEl.textContent = '';
}

async function init() {
  const SQL = await initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
  });

  let db = new SQL.Database();

  function registerMarkdown(database) {
    if (!window.marked) return;
    const fn = database.createFunction || database.create_function;
    if (!fn) {
      writeLine('markdown() not available in this build of sql.js');
      return;
    }
    fn.call(database, 'markdown', text => {
      if (text == null) return null;
      return marked.parse(String(text));
    });
  }

  registerMarkdown(db);

  async function loadSeed() {
    const jsonUrl = new URL('data/posts.json', window.location.href);
    const resp = await fetch(jsonUrl);
    const data = await resp.json();
    const createSql = `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      section TEXT,
      path TEXT NOT NULL UNIQUE,
      title TEXT,
      date TEXT,
      tags_json TEXT,
      meta_json TEXT,
      body_md TEXT
    );`;
    const createTags = `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE
    );`;
    const createPostTags = `CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(tag_id) REFERENCES tags(id)
    );`;
    db.exec(createSql);
    db.exec(createTags);
    db.exec(createPostTags);
    const insert = db.prepare('INSERT OR REPLACE INTO posts(slug, section, path, title, date, tags_json, meta_json, body_md) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags(tag) VALUES (?)');
    const insertPostTag = db.prepare('INSERT OR IGNORE INTO post_tags(post_id, tag_id) VALUES (?, ?)');
    const chunkSize = 200;
    for (let i = 0; i < data.length; i += chunkSize) {
      db.exec('BEGIN');
      const chunk = data.slice(i, i + chunkSize);
      for (const p of chunk) {
        insert.run([
          p.slug,
          p.section,
          p.path,
          p.title || null,
          p.date || null,
          p.tags ? JSON.stringify(p.tags) : null,
          JSON.stringify(p.meta || {}),
          p.body_md || ''
        ]);
        if (Array.isArray(p.tags)) {
          for (const t of p.tags) {
            const tag = String(t).trim();
            if (!tag) continue;
            insertTag.run([tag]);
          }
        }
      }
      // connect tags
      for (const p of chunk) {
        if (!Array.isArray(p.tags) || p.tags.length === 0) continue;
        const postIdRes = db.exec(`SELECT id FROM posts WHERE slug='${String(p.slug).replace(/'/g, "''")}'`);
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
      db.exec('COMMIT');
    }
    insert.free();
    insertTag.free();
    insertPostTag.free();
    writeLine(`Loaded data/posts.json (${data.length} posts)`);
  }

  async function runSql(sql) {
    const trimmed = sql.trim();
    if (!trimmed) {
      return;
    }

    // Dot commands (single line only)
    if (trimmed.startsWith('.')) {
      const [rawCmd, arg] = trimmed.split(/\s+/, 2);
      const cmd = rawCmd.replace(/;$/, '');
      if (cmd === '.help') {
        if (arg) {
          const topic = arg.trim();
          const helpMap = {
            '.mode': 'Usage: .mode [table|column|list|line|csv|json]',
            '.tables': 'Usage: .tables [pattern]',
            '.indexes': 'Usage: .indexes [table]',
            '.schema': 'Usage: .schema [pattern]',
            '.read': 'Usage: .read [path]',
            '.headers': 'Usage: .headers [on|off]',
            '.separator': 'Usage: .separator [text]',
            '.nullvalue': 'Usage: .nullvalue [text]',
            '.prompt': 'Usage: .prompt [main] [continue]',
            '.echo': 'Usage: .echo [on|off]',
            '.explain': 'Usage: .explain [on|off|full]',
            '.timer': 'Usage: .timer [on|off]',
            '.changes': 'Usage: .changes [on|off]',
            '.output': 'Usage: .output [filename]',
            '.once': 'Usage: .once [filename]',
            '.log': 'Usage: .log [filename|off]',
            '.quiet': 'Usage: .quiet [on|off]',
            '.share': 'Usage: .share [--open]',
            '.clear': 'Usage: .clear'
          };
          writeLine(helpMap[topic] || `No help for ${topic}`);
          return;
        }
        writeLine('Dot commands (supported):');
        writeLine('  .help [command]');
        writeLine('  .tables [pattern]');
        writeLine('  .indexes [table]');
        writeLine('  .schema [pattern]');
        writeLine('  .fullschema');
        writeLine('  .databases');
        writeLine('  .read [path]');
        writeLine('  .reset');
        writeLine('  .mode [table|column|list|line|csv|json]');
        writeLine('  .headers [on|off]');
        writeLine('  .separator [text]');
        writeLine('  .nullvalue [text]');
        writeLine('  .prompt [main] [continue]');
        writeLine('  .print [text]');
        writeLine('  .echo [on|off]');
        writeLine('  .explain [on|off|full]');
        writeLine('  .timer [on|off]');
        writeLine('  .changes [on|off]');
        writeLine('  .output [filename]');
        writeLine('  .once [filename]');
        writeLine('  .stats');
        writeLine('  .version');
        writeLine('  .log [filename|off]');
        writeLine('  .clear');
        writeLine('  .quiet [on|off]');
        writeLine('  .share [--open]');
        writeLine('  .show');
        writeLine('Unsupported in browser: .open .save .backup .restore .shell and more.');
        return;
      }
      if (cmd === '.tables') {
        const pattern = arg ? arg.trim() : '%';
        const like = pattern.includes('%') || pattern.includes('_') ? pattern : `%${pattern}%`;
        const res = db.exec(`SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name LIKE '${like.replace(/'/g, "''")}' ORDER BY name;`);
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.indexes') {
        if (!arg) {
          const res = db.exec("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;");
          if (res[0]) printResult(res[0]);
          return;
        }
        const table = arg.trim().replace(/'/g, "''");
        const res = db.exec(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}' ORDER BY name;`);
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.schema') {
        const table = arg ? arg.trim() : '';
        const like = table
          ? (table.includes('%') || table.includes('_') ? table : `%${table}%`)
          : '%';
        const q = table
          ? `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name LIKE '${like.replace(/'/g, "''")}' ORDER BY name;`
          : "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name;";
        const res = db.exec(q);
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.fullschema') {
        const res = db.exec("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name;");
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.databases') {
        const res = db.exec("SELECT 'main' AS name, ':memory:' AS file UNION ALL SELECT 'temp' AS name, '' AS file;");
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.read') {
        if (!arg) {
          writeLine('Missing path for .read');
          return;
        }
        const url = new URL(arg, window.location.href);
        const resp = await fetch(url);
        const text = await resp.text();
        db.exec(text);
        writeLine(`Read ${arg}`);
        return;
      }
      if (cmd === '.dump') {
        const table = arg ? arg.trim() : '';
        const where = table ? `AND name='${table.replace(/'/g, "''")}'` : '';
        const schemaRes = db.exec(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ${where} ORDER BY type, name;`);
        if (schemaRes[0]) {
          schemaRes[0].values.forEach(row => writeLine(row[0] + ';'));
        }
        const tablesRes = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ${where} ORDER BY name;`);
        if (tablesRes[0]) {
          for (const row of tablesRes[0].values) {
            const name = row[0];
            const res = db.exec(`SELECT * FROM \"${name}\";`);
            if (!res[0]) continue;
            const cols = res[0].columns;
            res[0].values.forEach(values => {
              const vals = values.map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
              writeLine(`INSERT INTO \"${name}\"(${cols.map(c => `\"${c}\"`).join(', ')}) VALUES (${vals.join(', ')});`);
            });
          }
        }
        flushOutputBuffer();
        return;
      }
      if (cmd === '.import') {
        const parts = trimmed.split(/\s+/).slice(1);
        const fileArg = parts[0];
        const table = parts[1];
        if (!table) {
          writeLine('Usage: .import FILE TABLE');
          return;
        }
        const input = document.getElementById('import-file');
        input.value = '';
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          const text = await file.text();
          const rows = text.trim().split(/\r?\n/).map(r => r.split(separator));
          if (rows.length === 0) return;
          const headers = rows.shift().map(h => h.trim());
          const createCols = headers.map(h => `\"${h.replace(/\"/g, '\"\"')}\" TEXT`).join(', ');
          db.exec(`CREATE TABLE IF NOT EXISTS \"${table}\" (${createCols});`);
          const insert = db.prepare(`INSERT INTO \"${table}\" (${headers.map(h => `\"${h.replace(/\"/g, '\"\"')}\"`).join(', ')}) VALUES (${headers.map(() => '?').join(', ')});`);
          db.exec('BEGIN');
          rows.forEach(r => insert.run(r));
          db.exec('COMMIT');
          insert.free();
          writeLine(`Imported ${rows.length} rows into ${table}`);
        };
        input.click();
        return;
      }
      if (cmd === '.mode') {
        if (!arg) {
          writeLine(`mode = ${outputMode}`);
          return;
        }
        const mode = arg.trim().toLowerCase();
        const allowed = ['table', 'column', 'list', 'line', 'csv', 'json'];
        if (!allowed.includes(mode)) {
          writeLine(`Unknown mode: ${mode}`);
          return;
        }
        outputMode = mode;
        writeLine(`mode = ${outputMode}`);
        return;
      }
      if (cmd === '.headers') {
        if (!arg) {
          writeLine(`headers = ${showHeaders ? 'on' : 'off'}`);
          return;
        }
        const v = arg.trim().toLowerCase();
        showHeaders = v === 'on' || v === '1' || v === 'true';
        writeLine(`headers = ${showHeaders ? 'on' : 'off'}`);
        return;
      }
      if (cmd === '.separator') {
        if (!arg) {
          writeLine(`separator = ${separator}`);
          return;
        }
        separator = arg;
        writeLine(`separator = ${separator}`);
        return;
      }
      if (cmd === '.nullvalue') {
        if (!arg) {
          writeLine(`nullvalue = ${nullValue}`);
          return;
        }
        nullValue = arg;
        writeLine(`nullvalue = ${nullValue}`);
        return;
      }
      if (cmd === '.prompt') {
        if (!arg) {
          writeLine(`prompt = ${promptMain} ${promptContinue}`);
          return;
        }
        const parts = trimmed.split(/\s+/).slice(1);
        promptMain = parts[0] || promptMain;
        promptContinue = parts[1] || promptContinue;
        if (promptLabelEl) promptLabelEl.textContent = promptMain;
        return;
      }
      if (cmd === '.print') {
        const text = trimmed.split(/\s+/).slice(1).join(' ');
        writeLine(text);
        return;
      }
      if (cmd === '.quiet') {
        const v = (arg || '').trim().toLowerCase();
        if (!v) {
          shellMsg(`quiet = ${quietOn ? 'on' : 'off'}`);
          return;
        }
        quietOn = v === 'on' || v === '1' || v === 'true';
        shellMsg(`quiet = ${quietOn ? 'on' : 'off'}`);
        return;
      }
      if (cmd === '.explain') {
        const v = (arg || '').trim().toLowerCase();
        if (!v) {
          writeLine(`explain = ${explainMode}`);
          return;
        }
        if (v === 'on') explainMode = 'query';
        else if (v === 'full') explainMode = 'full';
        else explainMode = 'off';
        writeLine(`explain = ${explainMode}`);
        return;
      }
      if (cmd === '.echo') {
        const v = (arg || '').trim().toLowerCase();
        echoOn = v === 'on' || v === '1' || v === 'true';
        writeLine(`echo = ${echoOn ? 'on' : 'off'}`);
        return;
      }
      if (cmd === '.timer') {
        const v = (arg || '').trim().toLowerCase();
        timerOn = v === 'on' || v === '1' || v === 'true';
        writeLine(`timer = ${timerOn ? 'on' : 'off'}`);
        return;
      }
      if (cmd === '.changes') {
        const v = (arg || '').trim().toLowerCase();
        changesOn = v === 'on' || v === '1' || v === 'true';
        writeLine(`changes = ${changesOn ? 'on' : 'off'}`);
        return;
      }
      if (cmd === '.output') {
        if (!arg) {
          outputFile = null;
          writeLine('output = screen');
          return;
        }
        outputFile = arg.trim();
        writeLine(`output = ${outputFile}`);
        return;
      }
      if (cmd === '.once') {
        if (!arg) {
          writeLine('Missing filename for .once');
          return;
        }
        outputOnce = arg.trim();
        writeLine(`once = ${outputOnce}`);
        return;
      }
      if (cmd === '.stats') {
        const res = db.exec(`SELECT
          (SELECT page_count FROM pragma_page_count) AS page_count,
          (SELECT page_size FROM pragma_page_size) AS page_size,
          (SELECT freelist_count FROM pragma_freelist_count) AS freelist,
          (SELECT cache_size FROM pragma_cache_size) AS cache_size,
          (SELECT encoding FROM pragma_encoding) AS encoding,
          (SELECT user_version FROM pragma_user_version) AS user_version;`);
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.version') {
        const res = db.exec("SELECT sqlite_version() AS sqlite_version;");
        if (res[0]) printResult(res[0]);
        return;
      }
      if (cmd === '.log') {
        if (!arg) {
          writeLine(`log = ${logFile ? logFile : 'off'}`);
          return;
        }
        const v = arg.trim();
        if (v === 'off') {
          flushLogBuffer();
          logFile = null;
          writeLine('log = off');
          return;
        }
        logFile = v;
        writeLine(`log = ${logFile}`);
        return;
      }
      if (cmd === '.show') {
        writeLine(`mode = ${outputMode}`);
        writeLine(`headers = ${showHeaders ? 'on' : 'off'}`);
        writeLine(`separator = ${separator}`);
        writeLine(`nullvalue = ${nullValue}`);
        writeLine(`echo = ${echoOn ? 'on' : 'off'}`);
        writeLine(`explain = ${explainMode}`);
        writeLine(`timer = ${timerOn ? 'on' : 'off'}`);
        writeLine(`changes = ${changesOn ? 'on' : 'off'}`);
        writeLine(`quiet = ${quietOn ? 'on' : 'off'}`);
        writeLine(`output = ${outputFile ? outputFile : 'screen'}`);
        writeLine(`log = ${logFile ? logFile : 'off'}`);
        return;
      }
      if (cmd === '.share') {
        const open = arg && arg.trim() === '--open';
        shareRender(open);
        return;
      }
      if (cmd === '.reset') {
        db = new SQL.Database();
        registerMarkdown(db);
        await loadSeed();
        writeLine('DB reset');
        return;
      }
      if (cmd === '.clear') {
        clearScreen();
        return;
      }
      if (unsupportedCommands.has(cmd)) {
        writeLine(`${cmd} is not supported in-browser.`);
        return;
      }
      writeLine(`Unknown command: ${cmd}`);
      return;
    }

    const statements = splitStatements(sql);
    for (const stmt of statements) {
      if (echoOn) writeLine(stmt + ';');
      const start = performance.now();
      try {
        const runStmt = explainMode === 'query'
          ? `EXPLAIN QUERY PLAN ${stmt}`
          : explainMode === 'full'
            ? `EXPLAIN ${stmt}`
            : stmt;
        const results = db.exec(runStmt);
        if (results.length > 0) {
          printResult(results[0]);
          lastResult = results[0];
          lastSqlText = stmt;
          lastError = '';
          lastRows = results[0].values.length;
        }
      } catch (err) {
        lastError = err && err.message ? err.message : String(err);
        if (!quietOn) writeLine(`Error: ${lastError}`);
      }
      lastRunMs = performance.now() - start;
      if (changesOn) {
        const changesRes = db.exec('SELECT changes() AS changes;');
        if (changesRes[0]) printResult(changesRes[0]);
      }
      if (timerOn) {
        writeLine(`Run time: ${lastRunMs.toFixed(3)} ms`);
      }
      flushOutputBuffer();
      updateStatus();
    }
    // auto-scroll after each execution
    window.scrollTo(0, document.body.scrollHeight);
    if (statements.length === 0) writeLine('No rows');
  }

  document.getElementById('reset').addEventListener('click', async () => {
    db = new SQL.Database();
    registerMarkdown(db);
    await loadSeed();
    writeLine('DB reset');
  });
  document.getElementById('load-seed').addEventListener('click', async () => {
    await loadSeed();
    writeLine('Loaded bundled posts');
  });
  document.getElementById('clear-screen').addEventListener('click', clearScreen);
  document.getElementById('copy-screen').addEventListener('click', async () => {
    await navigator.clipboard.writeText(screenEl.textContent);
    writeLine('Screen copied to clipboard.');
  });
  function shareRender(open) {
    if (!lastResult && !lastError) {
      shellMsg('No query results to render.');
      return;
    }
    const mode = document.getElementById('render-mode').value || 'auto';
    const vars = {
      title: document.getElementById('var-title').value.trim(),
      description: document.getElementById('var-description').value.trim(),
      layout_class: document.getElementById('var-layout-class').value.trim()
    };
    const templates = {};
    const layoutTpl = document.getElementById('tpl-layout').value.trim();
    const postTpl = document.getElementById('tpl-post').value.trim();
    if (layoutTpl) templates.layout = layoutTpl;
    if (postTpl) templates.post = postTpl;

    let columns = lastResult ? [...lastResult.columns] : [];
    let rows = lastResult ? lastResult.values.map(r => [...r]) : [];

    const lowerCols = columns.map(c => c.toLowerCase());
    const hasSlug = lowerCols.includes('slug');
    const hasBody = lowerCols.some(c => ['body_md','content','html','body_html'].includes(c));

    if (lastResult && hasSlug && !hasBody) {
      const slugIdx = lowerCols.indexOf('slug');
      const extra = {};
      for (const row of rows) {
        const slug = row[slugIdx];
        if (!slug) continue;
        const res = db.exec(`SELECT slug, title, date, body_md, meta_json FROM posts WHERE slug='${String(slug).replace(/'/g, "''")}' LIMIT 1;`);
        if (!res[0] || !res[0].values.length) continue;
        const [s, title, date, body, meta] = res[0].values[0];
        extra[s] = { title, date, body, meta };
      }

      const ensureCol = (name, getVal) => {
        if (columns.includes(name)) return;
        columns.push(name);
        for (const row of rows) {
          const slug = row[slugIdx];
          row.push(getVal(slug));
        }
      };

      ensureCol('title', slug => (extra[slug] && extra[slug].title) || '');
      ensureCol('date', slug => (extra[slug] && extra[slug].date) || '');
      ensureCol('body_md', slug => (extra[slug] && extra[slug].body) || '');
      ensureCol('description', slug => {
        const meta = extra[slug] && extra[slug].meta;
        if (!meta) return '';
        try {
          const obj = JSON.parse(meta);
          return obj.description || obj.excerpt || '';
        } catch {
          return '';
        }
      });
    }

    const payload = {
      sql: lastSqlText,
      columns,
      rows,
      mode,
      vars,
      templates,
      error: lastError || '',
      version: 1
    };

    const json = JSON.stringify(payload);
    const encoded = LZString.compressToEncodedURIComponent(json);
    const url = `${window.location.origin}/public/render.html#payload=${encoded}`;

    const shareInput = document.getElementById('share-url');
    shareInput.value = url;
    lastShareUrl = url;
    updateStatus();

    if (url.length > 8000) {
      shellMsg('Payload too large. Downloading JSON instead.');
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'render-payload.json';
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }

    navigator.clipboard.writeText(url).then(() => {
      shellMsg('Share URL copied to clipboard.');
    }).catch(() => {
      shareInput.focus();
      shareInput.select();
      shellMsg('Clipboard blocked. URL selected.');
    });

    if (open) window.open(url, '_blank');
  }

  document.getElementById('share-render').addEventListener('click', async () => {
    shareRender(false);
  });

  document.getElementById('copy-share').addEventListener('click', async () => {
    const shareInput = document.getElementById('share-url');
    if (!shareInput.value) return;
    try {
      await navigator.clipboard.writeText(shareInput.value);
      writeLine('Share URL copied to clipboard.');
    } catch {
      shareInput.focus();
      shareInput.select();
      writeLine('Clipboard blocked. URL selected.');
    }
  });

  document.getElementById('sql-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    db.exec(text);
    writeLine(`Loaded SQL file: ${file.name}`);
  });

  document.getElementById('json-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
    const data = JSON.parse(text);
    const createSql = `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      section TEXT,
      path TEXT NOT NULL UNIQUE,
      title TEXT,
      date TEXT,
      tags_json TEXT,
      meta_json TEXT,
      body_md TEXT
    );`;
    const createTags = `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE
    );`;
    const createPostTags = `CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(tag_id) REFERENCES tags(id)
    );`;
    db.exec(createSql);
    db.exec(createTags);
    db.exec(createPostTags);
    const insert = db.prepare('INSERT OR REPLACE INTO posts(slug, section, path, title, date, tags_json, meta_json, body_md) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags(tag) VALUES (?)');
    const insertPostTag = db.prepare('INSERT OR IGNORE INTO post_tags(post_id, tag_id) VALUES (?, ?)');
    db.exec('BEGIN');
    for (const p of data) {
      insert.run([
        p.slug,
        p.section,
        p.path,
        p.title || null,
        p.date || null,
        p.tags ? JSON.stringify(p.tags) : null,
        JSON.stringify(p.meta || {}),
        p.body_md || ''
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
      const postIdRes = db.exec(`SELECT id FROM posts WHERE slug='${String(p.slug).replace(/'/g, "''")}'`);
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
    insert.free();
    insertTag.free();
    insertPostTag.free();
    db.exec('COMMIT');
      writeLine(`Loaded JSON file: ${file.name} (${data.length} posts)`);
  });

  function getLastToken(value) {
    const m = value.match(/[^\\s]+$/);
    return m ? m[0] : '';
  }

  function replaceLastToken(value, replacement) {
    return value.replace(/[^\\s]+$/, replacement);
  }

  function getTableNames() {
    try {
      const res = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name;");
      if (!res[0]) return [];
      return res[0].values.map(v => String(v[0]));
    } catch {
      return [];
    }
  }

  // Input handling (terminal style)
  inputEl.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = inputEl.value;
      inputEl.value = '';
      history.unshift(line);
      historyIndex = -1;
      buffer = buffer ? `${buffer}\n${line}` : line;
      writeLine(`sqlite> ${line}`);
      if (line.trim().startsWith('.') || line.trim().endsWith(';')) {
        await runSql(buffer);
        buffer = '';
        if (promptLabelEl) promptLabelEl.textContent = 'sqlite>';
        writeLine('');
      } else {
        if (promptLabelEl) promptLabelEl.textContent = '   ...>';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      historyIndex = Math.min(historyIndex + 1, history.length - 1);
      inputEl.value = history[historyIndex];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0) return;
      historyIndex = Math.max(historyIndex - 1, -1);
      inputEl.value = historyIndex === -1 ? '' : history[historyIndex];
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const value = inputEl.value;
      const token = getLastToken(value);
      if (!token) return;
      const lower = token.toLowerCase();
      let candidates = [];
      if (token.startsWith('.')) {
        candidates = dotCommands;
      } else {
        candidates = [...sqlKeywords, ...getTableNames()];
      }
      const matches = candidates.filter(c => c.toLowerCase().startsWith(lower));
      if (matches.length === 1) {
        inputEl.value = replaceLastToken(value, matches[0] + ' ');
      } else if (matches.length > 1) {
        writeLine(matches.join(' '));
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      clearScreen();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      navigator.clipboard.writeText(screenEl.textContent);
      shellMsg('Screen copied to clipboard.');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      buffer = '';
      if (promptLabelEl) promptLabelEl.textContent = promptMain;
      inputEl.value = '';
      writeLine('^C');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      buffer = '';
      if (promptLabelEl) promptLabelEl.textContent = promptMain;
      inputEl.value = '';
    }
  });

  // Focus terminal input on load and click
  inputEl.focus();
  document.querySelector('.terminal').addEventListener('click', () => inputEl.focus());

  const optionsPanel = document.getElementById('options-panel');
  const optionsToggle = document.getElementById('options-toggle');
  const optionsClose = document.getElementById('options-close');
  const themeToggle = document.getElementById('theme-toggle');
  function setOptions(open) {
    if (open) optionsPanel.classList.add('open');
    else optionsPanel.classList.remove('open');
    optionsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  optionsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOptions(!optionsPanel.classList.contains('open'));
  });
  optionsClose.addEventListener('click', () => setOptions(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && optionsPanel.classList.contains('open')) {
      setOptions(false);
    }
  });

  function setTheme(mode) {
    document.body.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
    themeToggle.textContent = mode === 'light' ? 'Dark' : 'Light';
  }
  const stored = localStorage.getItem('theme') || 'dark';
  setTheme(stored);
  themeToggle.addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
  });

  // prevent accidental toggles on Enter while typing
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && optionsPanel.classList.contains('open')) {
      // keep panel open; no action needed
    }
  });


  await loadSeed();
  try {
    const res = db.exec('SELECT COUNT(*) AS count FROM posts;');
    if (res[0] && res[0].values.length) {
      setStatus('status-posts', String(res[0].values[0][0]));
    }
  } catch {}
  writeLine('SQLite blog shell ready.');
  writeLine('Type .help for dot commands.');
  if (promptLabelEl) promptLabelEl.textContent = promptMain;
}

init();
