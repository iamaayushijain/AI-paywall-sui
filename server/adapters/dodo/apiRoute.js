/**
 * Dodo-specific facilitator API routes.
 * Mounted at /v1/dodo by server/index.js.
 *
 * POST /v1/dodo/session           — create a Dodo payment session
 * GET  /v1/dodo/session/:id/status — poll session status
 * GET  /v1/dodo/session/:id/token  — issue content token once paid
 * GET  /v1/dodo/session/:id/paid   — return_url target (confirm paid)
 * GET  /v1/dodo/session/:id/cancel — cancel_url target
 */

import { Router } from "express";
import adapter from "./DodoPaymentAdapter.js";
import { verifyJwt } from "./DodoPaymentAdapter.js";
import { getSession } from "../../data/dodoSessions.js";

const router = Router();

/**
 * POST /v1/dodo/session
 *
 * Body: { publisherId, contentId, price }
 * Returns: { sessionId, paymentUrl, expiresIn }
 *
 * Called by the publisher SDK middleware when it needs to gate content.
 */
router.post("/session", async (req, res, next) => {
  try {
    const { publisherId, contentId, price, paymentMethodId } = req.body || {};
    if (!publisherId || typeof publisherId !== "string") {
      return res.status(400).json({ error: "publisherId is required" });
    }
    if (!contentId || typeof contentId !== "string") {
      return res.status(400).json({ error: "contentId is required" });
    }
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) {
      return res.status(400).json({ error: "price must be a positive number (USD)" });
    }

    // paymentMethodId is optional — when provided by an agent, Dodo auto-confirms
    // the payment without requiring a browser checkout.
    const { sessionId, paymentUrl } = await adapter.createPaymentSession(
      publisherId,
      contentId,
      priceNum,
      paymentMethodId || null
    );

    res.json({ sessionId, paymentUrl, expiresIn: 300 });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/dodo/session/:sessionId/status
 *
 * Returns: { status: 'pending' | 'paid' | 'expired', sessionId }
 *
 * Agents poll this until status = 'paid', then fetch the token.
 */
router.get("/session/:sessionId/status", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const status = await adapter.getSessionStatus(sessionId);
    res.json({ sessionId, status });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/dodo/session/:sessionId/token
 *
 * Returns: { token } — a signed JWT the agent includes as x-tollgate-token on retry.
 * Returns 402 if session is still pending, 410 if expired.
 */
router.get("/session/:sessionId/token", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const status = await adapter.getSessionStatus(sessionId);

    if (status === "expired") {
      return res.status(410).json({ error: "Session expired" });
    }
    if (status === "pending") {
      return res.status(402).json({ error: "Payment not yet confirmed", sessionId });
    }

    const token = await adapter.issueContentToken(sessionId);
    res.json({ token, sessionId });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/dodo/session/:sessionId/paid
 *
 * Dodo return_url — the agent lands here after completing payment in Dodo's
 * hosted checkout. We confirm the session and return the content token so
 * the agent can proceed without polling.
 */
router.get("/session/:sessionId/paid", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const status = await adapter.getSessionStatus(sessionId);

    if (status === "expired") {
      return res.status(410).json({ error: "Session expired" });
    }
    if (status === "pending") {
      // Payment may not have webhooks delivered yet — instruct agent to poll.
      return res.status(202).json({
        message: "Payment received — waiting for confirmation",
        sessionId,
        pollUrl: `/v1/dodo/session/${sessionId}/status`,
      });
    }

    const token = await adapter.issueContentToken(sessionId);
    res.json({ token, sessionId, message: "Payment confirmed. Use token to retry your request." });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/dodo/session/:sessionId/cancel
 *
 * Dodo cancel_url — agent abandoned checkout.
 */
router.get("/session/:sessionId/cancel", (req, res) => {
  res.status(200).json({
    message: "Payment cancelled",
    sessionId: req.params.sessionId,
  });
});

/**
 * POST /v1/dodo/token/verify
 *
 * Called by publisher SDK middleware to verify a x-tollgate-token.
 * Body: { token, resource }
 * Returns: { valid, sessionId, publisherId, contentId, amountUsd }
 */
router.post("/token/verify", async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ valid: false, error: "token is required" });
    }

    let payload;
    try {
      payload = verifyJwt(token);
    } catch (err) {
      return res.status(401).json({ valid: false, error: err.message });
    }

    const session = await getSession(payload.sub);
    if (!session) {
      return res.status(401).json({ valid: false, error: "Session not found" });
    }
    if (session.status !== "paid") {
      return res.status(402).json({ valid: false, error: "Session not paid", status: session.status });
    }
    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ valid: false, error: "Session expired" });
    }

    res.json({
      valid:       true,
      sessionId:   payload.sub,
      publisherId: payload.publisherId,
      contentId:   payload.contentId,
      amountUsd:   payload.amountUsd,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
