import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../crawlpay.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tx              TEXT NOT NULL UNIQUE,
    bot_name        TEXT,
    user_agent      TEXT,
    path            TEXT,
    page_hash       TEXT,
    lamports        INTEGER,
    relevance_score INTEGER,
    timestamp       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verified_tx_cache (
    tx        TEXT PRIMARY KEY,
    cached_at TEXT NOT NULL
  );
`);

// Migration: add relevance_score if upgrading from an older schema
const columns = db.pragma("table_info(payments)");
if (!columns.some((c) => c.name === "relevance_score")) {
  db.exec("ALTER TABLE payments ADD COLUMN relevance_score INTEGER");
}

export default db;
