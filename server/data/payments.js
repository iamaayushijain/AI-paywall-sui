import db from "./db.js";

const insertPayment = db.prepare(`
  INSERT OR IGNORE INTO payments
    (tx, bot_name, user_agent, path, page_hash, lamports, relevance_score, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectAllPayments = db.prepare(
  "SELECT * FROM payments ORDER BY timestamp DESC",
);

const selectTxCache = db.prepare(
  "SELECT 1 FROM verified_tx_cache WHERE tx = ?",
);

const insertTxCache = db.prepare(
  "INSERT OR IGNORE INTO verified_tx_cache (tx, cached_at) VALUES (?, ?)",
);

const sumLamports = db.prepare(
  "SELECT COALESCE(SUM(lamports), 0) AS total FROM payments",
);

export function recordPayment({ tx, botName, userAgent, path, pageHash, lamports, relevanceScore }) {
  insertPayment.run(
    tx,
    botName || null,
    userAgent || null,
    path || null,
    pageHash || null,
    lamports || null,
    relevanceScore || null,
    new Date().toISOString(),
  );
}

export function getAllPayments() {
  return selectAllPayments.all().map((row) => ({
    txSignature: row.tx,
    botName: row.bot_name,
    userAgent: row.user_agent,
    path: row.path,
    pageHash: row.page_hash,
    lamports: row.lamports,
    relevanceScore: row.relevance_score,
    timestamp: row.timestamp,
  }));
}

export function getTotalLamports() {
  return sumLamports.get().total;
}

export function isTxCached(tx) {
  return !!selectTxCache.get(tx);
}

export function cacheTx(tx) {
  insertTxCache.run(tx, new Date().toISOString());
}
