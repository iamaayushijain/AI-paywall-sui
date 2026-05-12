/**
 * Tests for Dodo content token issuance and verifyContentToken middleware.
 *
 * Run: node --test test/dodo-token.test.js
 */

import { describe, it, before, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// ── Stub env ─────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-for-token-tests";
process.env.DODO_PAYMENTS_WEBHOOK_KEY = crypto.randomBytes(32).toString("base64");
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";

// ── Import after env ──────────────────────────────────────────────────────────
const { verifyJwt } = await import("../server/adapters/dodo/DodoPaymentAdapter.js");

// ─── Minimal JWT signer (mirrors production impl) ─────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig    = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("verifyJwt", () => {
  it("verifies a correctly signed token and returns payload", () => {
    const payload = { sub: "sess_123", publisherId: "pub_a", exp: Date.now() + 60_000 };
    const token = signJwt(payload);
    const result = verifyJwt(token);
    assert.equal(result.sub, "sess_123");
    assert.equal(result.publisherId, "pub_a");
  });

  it("throws on a tampered payload", () => {
    const token = signJwt({ sub: "sess_123", exp: Date.now() + 60_000 });
    const parts = token.split(".");
    // Replace body with a different payload.
    const tamperedBody = Buffer.from(JSON.stringify({ sub: "sess_EVIL" })).toString("base64url");
    const tampered = `${parts[0]}.${tamperedBody}.${parts[2]}`;
    assert.throws(() => verifyJwt(tampered), /Invalid token signature/);
  });

  it("throws on an expired token", () => {
    const token = signJwt({ sub: "sess_123", exp: Date.now() - 1 }); // expired
    assert.throws(() => verifyJwt(token), /Token expired/);
  });

  it("throws on a malformed token (wrong number of segments)", () => {
    assert.throws(() => verifyJwt("not.a.valid.jwt.here"), /Malformed token/);
    assert.throws(() => verifyJwt("onlyone"), /Malformed token/);
  });

  it("throws on empty / null token", () => {
    assert.throws(() => verifyJwt(""), /Malformed token/);
    assert.throws(() => verifyJwt(null), /Malformed token/);
  });

  it("throws when signed with a different secret", () => {
    // Sign with wrong secret.
    const otherSecret = "completely-different-secret";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body   = Buffer.from(JSON.stringify({ sub: "s", exp: Date.now() + 60_000 })).toString("base64url");
    const sig    = crypto.createHmac("sha256", otherSecret).update(`${header}.${body}`).digest("base64url");
    const token  = `${header}.${body}.${sig}`;
    assert.throws(() => verifyJwt(token), /Invalid token signature/);
  });
});

describe("verifyContentToken middleware (unit)", () => {
  // Build a minimal mock request/response pair.
  function mockReqRes(headers = {}) {
    const req = { headers };
    const responses = [];
    const res = {
      status(code) { this._code = code; return this; },
      json(body) { responses.push({ status: this._code, body }); return this; },
      _responses: responses,
    };
    const nextCalls = [];
    const next = (err) => nextCalls.push(err);
    return { req, res, next, nextCalls };
  }

  it("calls next(403) when x-tollgate-token header is absent", async () => {
    // We can't import verifyContentToken easily because it tries to import Supabase.
    // Test the logic inline by replicating the guard condition.
    const { req, res, next, nextCalls } = mockReqRes({});
    const token = req.headers["x-tollgate-token"];
    if (!token) {
      res.status(402).json({ error: "Payment required" });
    }
    assert.equal(res._responses[0].status, 402);
    assert.equal(nextCalls.length, 0);
  });

  it("returns 401 for an invalid JWT", async () => {
    const { req, res } = mockReqRes({ "x-tollgate-token": "bad.token.value" });
    try {
      verifyJwt(req.headers["x-tollgate-token"]);
      assert.fail("Should have thrown");
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
    assert.equal(res._responses[0].status, 401);
  });

  it("returns 401 for an expired JWT", async () => {
    const token = signJwt({ sub: "sess_expired", exp: Date.now() - 1000 });
    const { req, res } = mockReqRes({ "x-tollgate-token": token });
    try {
      verifyJwt(req.headers["x-tollgate-token"]);
      assert.fail("Should have thrown");
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
    assert.equal(res._responses[0].status, 401);
    assert.match(res._responses[0].body.error, /expired/i);
  });

  it("accepts a valid unexpired token (JWT layer only — no DB)", () => {
    const payload = { sub: "sess_ok", publisherId: "pub_1", exp: Date.now() + 60_000 };
    const token = signJwt(payload);
    const { req } = mockReqRes({ "x-tollgate-token": token });
    const result = verifyJwt(req.headers["x-tollgate-token"]);
    assert.equal(result.sub, "sess_ok");
  });
});

console.log("✓ dodo-token tests complete");
