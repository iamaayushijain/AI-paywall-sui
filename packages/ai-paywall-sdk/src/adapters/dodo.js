/**
 * Dodo Payments adapter for the Tollgate publisher SDK.
 *
 * Drop-in Express middleware for publishers using Dodo as the payment rail
 * instead of Solana. Uses the same HTTP 402 + x-payment-required flow but
 * replaces on-chain USDC with a Dodo hosted checkout.
 *
 * Usage:
 *   import { dodoMiddleware } from "tollgate-sdk/dodo";
 *
 *   app.use(dodoMiddleware({
 *     publisherId:  "my-site",          // any opaque string
 *     price:        0.01,               // USD per access
 *     protect:      ["/articles/*"],    // globs; defaults to all routes
 *     apiUrl:       "https://your-facilitator.railway.app",
 *   }));
 *
 *   // On paid requests:
 *   app.get("/articles/:slug", (req, res) => {
 *     console.log(req.tollgate); // { sessionId, publisherId, contentId, amountUsd }
 *     res.json({ content: "..." });
 *   });
 */

import { detectBot } from "../core/botDetector.js";

const DEFAULT_API_URL = "https://ai-paywall-production-f453.up.railway.app";
const DEFAULT_PRICE_USD = 0.01;
const DEFAULT_TIMEOUT_MS = 8000;

function getHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()];
}

function pathMatches(pathname, matchers) {
  if (!matchers || matchers.length === 0) return true;
  for (const m of matchers) {
    if (m instanceof RegExp) { if (m.test(pathname)) return true; continue; }
    if (typeof m === "string") {
      if (m === pathname) return true;
      if (m.endsWith("/*") && pathname.startsWith(m.slice(0, -2))) return true;
      if (m.endsWith("*")  && pathname.startsWith(m.slice(0, -1)))  return true;
    }
  }
  return false;
}

async function facilitatorPost(apiUrl, path, body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function facilitatorGet(apiUrl, path, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}${path}`, { signal: ctrl.signal });
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Creates an Express middleware that gates routes using Dodo Payments.
 *
 * @param {object} options
 * @param {string}   options.publisherId            Opaque publisher identifier.
 * @param {number}   [options.price=0.01]           Price per access in USD.
 * @param {string[]} [options.protect=["/*"]]       Path glob matchers.
 * @param {string}   [options.apiUrl]               Facilitator base URL.
 * @param {number}   [options.botScoreThreshold=70] Bot detection sensitivity.
 * @param {boolean}  [options.failOpen=false]        Allow through if facilitator is down.
 * @param {Function} [options.onDetection]           Hook called with detection result.
 */
export function dodoMiddleware({
  publisherId,
  price = DEFAULT_PRICE_USD,
  protect = ["/*"],
  apiUrl = DEFAULT_API_URL,
  botScoreThreshold = 70,
  failOpen = false,
  onDetection,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!publisherId) {
    throw new Error("dodoMiddleware requires { publisherId }");
  }

  const base = apiUrl.replace(/\/$/, "");

  return async function dodoPaywallMiddleware(req, res, next) {
    try {
      const pathname = req.originalUrl?.split("?")[0] || req.path;

      // ── Path guard ─────────────────────────────────────────────────────────
      if (!pathMatches(pathname, protect)) return next();

      // ── Bot detection ──────────────────────────────────────────────────────
      const detection = detectBot(
        { headers: req.headers, method: req.method },
        { botScoreThreshold, allowList: undefined }
      );
      if (onDetection) { try { onDetection(detection); } catch { /* swallow */ } }
      if (!detection.isBot) return next();

      // ── Dodo flow ─────────────────────────────────────────────────────────

      const tollgateToken = getHeader(req.headers, "x-tollgate-token");

      if (!tollgateToken) {
        // First request — create a Dodo payment session and return 402.
        let session;
        try {
          session = await facilitatorPost(base, "/v1/dodo/session", {
            publisherId,
            contentId: pathname,
            price,
          }, timeoutMs);
        } catch (err) {
          if (failOpen) return next();
          return res.status(503).json({ error: "Payment system unavailable", detail: err.message });
        }

        const paymentHeader = JSON.stringify({
          amount:      String(price),
          currency:    "USD",
          adapter:     "dodo",
          payment_url: session.paymentUrl,
          session_id:  session.sessionId,
          expires_in:  session.expiresIn || 300,
        });

        return res.status(402)
          .set("x-payment-required", paymentHeader)
          .set("Content-Type", "application/json")
          .json({
            error:      "Payment required",
            adapter:    "dodo",
            payment_url: session.paymentUrl,
            session_id:  session.sessionId,
            expires_in:  session.expiresIn || 300,
            instructions: [
              `1. Complete payment at payment_url`,
              `2. Poll GET ${base}/v1/dodo/session/${session.sessionId}/status until status=paid`,
              `3. GET ${base}/v1/dodo/session/${session.sessionId}/token to receive x-tollgate-token`,
              `4. Retry this request with header: x-tollgate-token: <token>`,
            ],
          });
      }

      // Retry with token — verify via facilitator.
      let verification;
      try {
        verification = await facilitatorPost(base, "/v1/dodo/token/verify", {
          token:    tollgateToken,
          resource: pathname,
        }, timeoutMs);
      } catch (err) {
        if (err.status === 401 || err.status === 402) {
          return res.status(err.status).json({ error: err.message || "Token invalid" });
        }
        if (failOpen) return next();
        return res.status(503).json({ error: "Token verification unavailable" });
      }

      if (!verification.valid) {
        return res.status(401).json({ error: verification.error || "Invalid token" });
      }

      // Attach verified session data for downstream handlers.
      req.tollgate = {
        sessionId:   verification.sessionId,
        publisherId: verification.publisherId,
        contentId:   verification.contentId,
        amountUsd:   verification.amountUsd,
        adapter:     "dodo",
      };

      return next();
    } catch (err) {
      if (failOpen) return next();
      next(err);
    }
  };
}
