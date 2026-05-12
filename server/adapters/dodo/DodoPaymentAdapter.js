/**
 * DodoPaymentAdapter
 *
 * Implements the payment adapter interface using Dodo Payments as the
 * settlement layer. All Dodo-specific logic lives here.
 *
 * Interface (same shape as any future adapter):
 *   createPaymentSession(publisherId, contentId, price) → { paymentUrl, sessionId }
 *   verifyWebhook(rawBody, headers) → boolean
 *   getSessionStatus(sessionId) → 'pending' | 'paid' | 'expired'
 *   issueContentToken(sessionId) → string (signed JWT)
 */

import crypto from "node:crypto";
import DodoPayments from "dodopayments";
import {
  createSession,
  getSession,
  markSessionPaid,
  recordUsageEvent,
} from "../../data/dodoSessions.js";

// ─── Config ─────────────────────────────────────────────────────────────────

const DODO_API_KEY   = process.env.DODO_PAYMENTS_API_KEY;
const DODO_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
const DODO_ENV       = process.env.DODO_ENVIRONMENT || "test_mode";
const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID;
const JWT_SECRET     = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";

// 5-minute session TTL — agent must complete payment before this expires.
const SESSION_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS   = 60 * 60 * 1000; // 1h content token TTL

// ─── Dodo client ─────────────────────────────────────────────────────────────

function getDodoClient() {
  if (!DODO_API_KEY) {
    throw new Error("DODO_PAYMENTS_API_KEY is not set");
  }
  return new DodoPayments({
    bearerToken: DODO_API_KEY,
    environment: DODO_ENV,
  });
}

// ─── Minimal JWT (no external dep) ───────────────────────────────────────────

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig    = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const sigBuf      = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error("Token expired");
  }
  return payload;
}

// ─── Webhook signature (Standard Webhooks / HMAC-SHA256) ─────────────────────

export function verifyDodoWebhookSignature(rawBody, headers) {
  const msgId        = headers["webhook-id"]        || headers["Webhook-Id"];
  const msgTimestamp = headers["webhook-timestamp"] || headers["Webhook-Timestamp"];
  const msgSignature = headers["webhook-signature"] || headers["Webhook-Signature"];

  if (!msgId || !msgTimestamp || !msgSignature || !DODO_WEBHOOK_KEY) {
    return false;
  }

  // Reject replays older than 5 minutes.
  const ts = parseInt(msgTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  // Dodo webhook keys may be raw base64 or prefixed with "whsec_".
  let secretBytes;
  try {
    const raw = DODO_WEBHOOK_KEY.startsWith("whsec_")
      ? DODO_WEBHOOK_KEY.slice(6)
      : DODO_WEBHOOK_KEY;
    secretBytes = Buffer.from(raw, "base64");
  } catch {
    return false;
  }

  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const toSign = `${msgId}.${msgTimestamp}.${body}`;
  const computed = crypto.createHmac("sha256", secretBytes).update(toSign, "utf8").digest("base64");

  // Header format: "v1,<base64sig> v1,<base64sig2>" (multiple sigs possible).
  const sigs = msgSignature.split(" ");
  return sigs.some((entry) => {
    const comma = entry.indexOf(",");
    if (comma === -1) return false;
    const version = entry.slice(0, comma);
    const sig     = entry.slice(comma + 1);
    if (version !== "v1" || !sig) return false;
    try {
      const sigBuf      = Buffer.from(sig, "base64");
      const computedBuf = Buffer.from(computed, "base64");
      if (sigBuf.length !== computedBuf.length) return false;
      return crypto.timingSafeEqual(computedBuf, sigBuf);
    } catch {
      return false;
    }
  });
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class DodoPaymentAdapter {
  /**
   * Create a Dodo Checkout Session for a bot trying to access gated content.
   *
   * @param {string} publisherId  - Opaque publisher identifier (wallet address or slug).
   * @param {string} contentId    - The resource path being accessed (e.g. "/articles/ai").
   * @param {number} price        - Price in USD (e.g. 0.01 for $0.01).
   * @returns {{ paymentUrl: string, sessionId: string }}
   */
  async createPaymentSession(publisherId, contentId, price, paymentMethodId = null) {
    if (!DODO_PRODUCT_ID) {
      throw new Error(
        "DODO_PRODUCT_ID is not set. Create a product in the Dodo dashboard and set this env var."
      );
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const client = getDodoClient();
    const sessionParams = {
      product_cart: [{ product_id: DODO_PRODUCT_ID, quantity: 1 }],
      customer: { email: `agent+${sessionId.slice(0, 8)}@tollgate.bot` },
      return_url: `${FACILITATOR_URL}/v1/dodo/session/${sessionId}/paid`,
      cancel_url:  `${FACILITATOR_URL}/v1/dodo/session/${sessionId}/cancel`,
      metadata: {
        tollgate_session_id: sessionId,
        publisher_id: publisherId,
        content_id: contentId,
      },
    };

    // If the agent passes a pre-saved payment method, auto-confirm without browser.
    if (paymentMethodId) {
      sessionParams.payment_method_id = paymentMethodId;
    }

    const dodoSession = await client.checkoutSessions.create(sessionParams);

    await createSession({
      sessionId,
      dodoSessionId: dodoSession.session_id,
      publisherId,
      contentId,
      amountUsd: price,
      expiresAt,
    });

    return {
      paymentUrl: dodoSession.checkout_url,
      sessionId,
    };
  }

  /**
   * Verify a Dodo webhook request.
   *
   * @param {Buffer|string} rawBody - Raw request body (before JSON parsing).
   * @param {object} headers        - Request headers object.
   * @returns {boolean}
   */
  verifyWebhook(rawBody, headers) {
    return verifyDodoWebhookSignature(rawBody, headers);
  }

  /**
   * Get the current status of a payment session.
   *
   * @param {string} sessionId
   * @returns {'pending' | 'paid' | 'expired'}
   */
  async getSessionStatus(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return "expired";
    if (session.status === "paid") return "paid";
    if (new Date(session.expires_at) < new Date()) return "expired";
    return "pending";
  }

  /**
   * Issue a signed JWT content token for a paid session.
   * The agent presents this token on retry via x-tollgate-token.
   *
   * @param {string} sessionId
   * @returns {string} signed JWT
   */
  async issueContentToken(sessionId) {
    const session = await getSession(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "paid") throw new Error("Session not paid");
    if (new Date(session.expires_at) < new Date()) throw new Error("Session expired");

    return signJwt({
      sub: sessionId,
      publisherId: session.publisher_id,
      contentId:   session.content_id,
      amountUsd:   session.amount_usd,
      exp: Date.now() + TOKEN_TTL_MS,
    });
  }

  /**
   * Process a verified payment.succeeded webhook event.
   * Called internally by the webhook route after signature verification.
   *
   * @param {object} event - Parsed Dodo webhook payload.
   */
  async handlePaymentSucceeded(event) {
    const sessionId     = event.data?.metadata?.tollgate_session_id;
    const dodoPaymentId = event.data?.payment_id;
    const amountCents   = event.data?.total_amount || 0;
    const amountUsd     = amountCents / 100;

    if (!sessionId) {
      console.warn("[dodo] payment.succeeded missing tollgate_session_id in metadata");
      return;
    }

    const session = await getSession(sessionId);
    if (!session) {
      console.warn(`[dodo] payment.succeeded for unknown session ${sessionId}`);
      return;
    }

    await markSessionPaid({ sessionId, dodoPaymentId, amountUsd });

    await recordUsageEvent({
      publisherId:    session.publisher_id,
      contentId:      session.content_id,
      sessionId,
      dodoPaymentId,
      amountUsd,
      botIdentity:    null, // enriched later from dodo_sessions if needed
    });

    console.log(`[dodo] Session ${sessionId} paid — ${amountUsd} USD (tx: ${dodoPaymentId})`);
  }
}

export default new DodoPaymentAdapter();
