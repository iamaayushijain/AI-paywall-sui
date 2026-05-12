/**
 * End-to-end test for the Dodo Payments adapter.
 *
 * Run: node test/e2e-dodo.js
 *
 * What it does:
 *  1. Hits the local server as a bot → asserts HTTP 402 with Dodo envelope
 *  2. Prints the Dodo checkout URL → you pay with a test card in the browser
 *  3. Polls /v1/dodo/session/:id/status every 3s until webhook confirms payment
 *  4. Fetches the JWT content token
 *  5. Retries the original request with x-tollgate-token → asserts HTTP 200
 */

import "dotenv/config";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const PROTECTED_PATH = process.env.PROTECTED_PATH || "/articles/test";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 5 * 60 * 1000; // wait up to 5 min for you to pay

// ── colours ───────────────────────────────────────────────────────────────────
const g = "\x1b[32m", y = "\x1b[33m", c = "\x1b[36m", r = "\x1b[31m",
      b = "\x1b[1m",  d = "\x1b[2m",  z = "\x1b[0m";
const ok   = `${g}✓${z}`;
const fail = `${r}✗${z}`;
const info = `${c}→${z}`;

function log(msg) { process.stdout.write(msg + "\n"); }
function sep()    { log(`${d}${"─".repeat(60)}${z}`); }

// ── helpers ───────────────────────────────────────────────────────────────────
async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body };
}

async function post(path, data) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function assert(condition, msg) {
  if (!condition) {
    log(`\n${fail} ASSERTION FAILED: ${msg}\n`);
    process.exit(1);
  }
  log(`${ok} ${msg}`);
}

async function poll(sessionId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let dots = 0;
  while (Date.now() < deadline) {
    const { body } = await get(`/v1/dodo/session/${sessionId}/status`);
    if (body.status === "paid") {
      process.stdout.write("\n");
      return "paid";
    }
    if (body.status === "expired") {
      process.stdout.write("\n");
      return "expired";
    }
    process.stdout.write(dots++ % 20 === 0 ? "." : "");
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  process.stdout.write("\n");
  return "timeout";
}

// ── main ──────────────────────────────────────────────────────────────────────
log(`\n${b}Tollgate × Dodo Payments — E2E Test${z}`);
log(`${d}Target: ${z}${BASE}${PROTECTED_PATH}\n`);

// ── 1. Health check ───────────────────────────────────────────────────────────
sep();
log(`${b}1. Health check${z}`);
const health = await get("/health");
assert(health.status === 200, `Server is up (${BASE})`);

// ── 2. Human request passes through ──────────────────────────────────────────
sep();
log(`${b}2. Human browser request → should pass through${z}`);
const human = await get(PROTECTED_PATH, {
  "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Site":  "none",
});
assert(human.status === 200, `Human gets 200 (no paywall)`);

// ── 3. Bot request → HTTP 402 with Dodo envelope ─────────────────────────────
sep();
log(`${b}3. Bot request → expect HTTP 402 (Dodo adapter)${z}`);
const bot = await get(PROTECTED_PATH, { "User-Agent": "GPTBot/1.0" });

assert(bot.status === 402, `Bot gets HTTP 402`);
assert(bot.body.adapter === "dodo", `Response body has adapter: "dodo"`);
assert(typeof bot.body.payment_url === "string" && bot.body.payment_url.startsWith("https://"),
  `payment_url is a real Dodo checkout URL`);
assert(typeof bot.body.session_id === "string", `session_id present`);

const xHeader = bot.headers.get("x-payment-required");
assert(!!xHeader, `x-payment-required header present`);
const parsedHeader = JSON.parse(xHeader);
assert(parsedHeader.adapter === "dodo",    `x-payment-required.adapter = "dodo"`);
assert(parsedHeader.currency === "USD",    `x-payment-required.currency = "USD"`);
assert(parsedHeader.payment_url === bot.body.payment_url, `header URL matches body URL`);

const { session_id: sessionId, payment_url: paymentUrl } = bot.body;
log(`\n  ${d}session_id:${z}  ${sessionId}`);
log(`  ${d}amount:${z}      $${parsedHeader.amount} USD`);

// ── 4. User action: open the payment URL ─────────────────────────────────────
sep();
log(`${b}4. Complete the payment${z}`);
log(`\n  ${y}Open this URL in your browser and pay with a test card:${z}\n`);
log(`  ${b}${c}${paymentUrl}${z}\n`);
log(`  ${d}Test card:${z}  4111 1111 1111 1111`);
log(`  ${d}Expiry:${z}     any future date  (e.g. 12/28)`);
log(`  ${d}CVC:${z}        any 3 digits     (e.g. 123)`);
log(`  ${d}Name/email:${z} anything\n`);
log(`  Waiting for Dodo webhook to confirm payment`);
process.stdout.write("  Polling ");

// ── 5. Poll until paid ────────────────────────────────────────────────────────
const pollResult = await poll(sessionId);
if (pollResult === "timeout") {
  log(`\n${fail} Timed out after 5 minutes — did you complete the payment?\n`);
  process.exit(1);
}
if (pollResult === "expired") {
  log(`\n${fail} Session expired — restart the test and pay faster.\n`);
  process.exit(1);
}
assert(pollResult === "paid", `Session ${sessionId} is now paid`);

// ── 6. Fetch content token ────────────────────────────────────────────────────
sep();
log(`${b}5. Fetch content token${z}`);
const tokenRes = await get(`/v1/dodo/session/${sessionId}/token`);
assert(tokenRes.status === 200, `Token endpoint returns 200`);
assert(typeof tokenRes.body.token === "string", `JWT token returned`);

const { token } = tokenRes.body;
log(`  ${d}token (first 60 chars):${z} ${token.slice(0, 60)}…`);

// ── 7. Retry with token → 200 ────────────────────────────────────────────────
sep();
log(`${b}6. Retry protected route with x-tollgate-token → expect 200${z}`);
const unlocked = await get(PROTECTED_PATH, {
  "User-Agent":      "GPTBot/1.0",
  "x-tollgate-token": token,
});

assert(unlocked.status === 200, `Bot gets HTTP 200 after payment`);
assert(unlocked.body.tollgate?.adapter === "dodo", `req.tollgate.adapter = "dodo"`);
assert(unlocked.body.tollgate?.sessionId === sessionId, `req.tollgate.sessionId matches`);

log(`\n  ${d}publisher:${z}   ${unlocked.body.tollgate?.publisherId || "(set via middleware)"}`);
log(`  ${d}amount:${z}      $${unlocked.body.tollgate?.amountUsd} USD`);
log(`  ${d}adapter:${z}     ${unlocked.body.tollgate?.adapter}`);

// ── 8. Replay protection: same token on different resource ────────────────────
sep();
log(`${b}7. Token verify endpoint (standalone check)${z}`);
const verifyRes = await post("/v1/dodo/token/verify", { token });
assert(verifyRes.status === 200,       `Token verifies successfully`);
assert(verifyRes.body.valid === true,  `valid = true`);
assert(verifyRes.body.sessionId === sessionId, `sessionId matches`);

// ── done ──────────────────────────────────────────────────────────────────────
sep();
log(`\n${b}${g}✓ All checks passed — Dodo adapter is working end-to-end${z}\n`);
log(`  Adapter        ${g}Dodo Payments${z}`);
log(`  Session        ${sessionId}`);
log(`  Payment URL    ${paymentUrl}`);
log(`  Token          ${token.slice(0, 40)}…`);
log(`  Settlement     ${g}USD (not USDC, not Solana)${z}\n`);
