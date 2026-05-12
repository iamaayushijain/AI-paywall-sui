/**
 * Tests for the Dodo webhook handler and signature verification.
 *
 * Run: node --test test/dodo-webhook.test.js
 * (requires Node.js >= 18 for built-in test runner and crypto)
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// ── Stub env before importing modules that read it at load time ───────────────
const WEBHOOK_SECRET_RAW = crypto.randomBytes(32);
const WEBHOOK_SECRET_B64 = WEBHOOK_SECRET_RAW.toString("base64");
process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_SECRET_B64;
process.env.JWT_SECRET = "test-jwt-secret";
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";

// ── Import after env is set ───────────────────────────────────────────────────
const { verifyDodoWebhookSignature } = await import(
  "../server/adapters/dodo/DodoPaymentAdapter.js"
);

// ── Helper: build a valid webhook request ────────────────────────────────────

function buildWebhookRequest(body, opts = {}) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  const msgId        = opts.msgId        ?? `msg_${crypto.randomBytes(8).toString("hex")}`;
  const msgTimestamp = opts.msgTimestamp ?? String(Math.floor(Date.now() / 1000));
  const toSign       = `${msgId}.${msgTimestamp}.${rawBody}`;
  const computed     = crypto
    .createHmac("sha256", WEBHOOK_SECRET_RAW)
    .update(toSign, "utf8")
    .digest("base64");
  const signature = `v1,${computed}`;

  return {
    rawBody,
    headers: {
      "webhook-id":        opts.overrideId        ?? msgId,
      "webhook-timestamp": opts.overrideTimestamp  ?? msgTimestamp,
      "webhook-signature": opts.overrideSig        ?? signature,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("verifyDodoWebhookSignature", () => {
  it("accepts a correctly signed webhook", () => {
    const { rawBody, headers } = buildWebhookRequest({ type: "payment.succeeded" });
    assert.equal(verifyDodoWebhookSignature(rawBody, headers), true);
  });

  it("rejects a tampered body", () => {
    const { headers } = buildWebhookRequest({ type: "payment.succeeded" });
    assert.equal(
      verifyDodoWebhookSignature('{"type":"payment.succeeded","tampered":true}', headers),
      false
    );
  });

  it("rejects an incorrect signature", () => {
    const { rawBody, headers } = buildWebhookRequest({ type: "payment.succeeded" });
    assert.equal(
      verifyDodoWebhookSignature(rawBody, { ...headers, "webhook-signature": "v1,badsig==" }),
      false
    );
  });

  it("rejects a stale webhook (timestamp > 5 minutes old)", () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const { rawBody, headers } = buildWebhookRequest(
      { type: "payment.succeeded" },
      { msgTimestamp: staleTimestamp }
    );
    assert.equal(verifyDodoWebhookSignature(rawBody, headers), false);
  });

  it("rejects when webhook-id header is missing", () => {
    const { rawBody, headers } = buildWebhookRequest({ type: "payment.succeeded" });
    const { "webhook-id": _removed, ...withoutId } = headers;
    assert.equal(verifyDodoWebhookSignature(rawBody, withoutId), false);
  });

  it("rejects when webhook-signature header is missing", () => {
    const { rawBody, headers } = buildWebhookRequest({ type: "payment.succeeded" });
    const { "webhook-signature": _removed, ...withoutSig } = headers;
    assert.equal(verifyDodoWebhookSignature(rawBody, withoutSig), false);
  });

  it("accepts multiple valid signatures (v1,sig1 v1,sig2 format)", () => {
    const { rawBody, headers } = buildWebhookRequest({ type: "payment.succeeded" });
    const validSig = headers["webhook-signature"];
    const fakeOther = "v1,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==";
    // Two sigs in the header — first is invalid, second is valid.
    const multiSig = `${fakeOther} ${validSig}`;
    assert.equal(
      verifyDodoWebhookSignature(rawBody, { ...headers, "webhook-signature": multiSig }),
      true
    );
  });

  it("accepts Buffer rawBody as well as string", () => {
    const body = JSON.stringify({ type: "payment.succeeded" });
    const { headers } = buildWebhookRequest(body);
    assert.equal(verifyDodoWebhookSignature(Buffer.from(body), headers), true);
  });
});

describe("handlePaymentSucceeded (unit — stubs DB)", () => {
  it("logs a warning and returns when tollgate_session_id is missing", async () => {
    // Import the adapter for black-box test — DB calls will fail gracefully
    // because SUPABASE config is a placeholder. We're testing control flow.
    const { default: adapter } = await import(
      "../server/adapters/dodo/DodoPaymentAdapter.js"
    );

    const event = {
      type: "payment.succeeded",
      data: {
        payment_id:   "pay_test",
        total_amount: 100,
        metadata:     {}, // no tollgate_session_id
      },
    };

    // Should resolve without throwing (warns internally).
    await assert.doesNotReject(() => adapter.handlePaymentSucceeded(event));
  });
});

console.log("✓ dodo-webhook tests complete");
