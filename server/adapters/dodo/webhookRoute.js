/**
 * POST /webhook/dodo
 *
 * Receives Dodo payment webhooks. Must be mounted with express.raw() so the
 * raw body is available for HMAC signature verification — express.json()
 * must NOT have run on this route.
 *
 * Processing is fire-and-forget: we respond 200 immediately and handle
 * async state updates in the background so Dodo doesn't retry on our latency.
 */

import { Router } from "express";
import adapter from "./DodoPaymentAdapter.js";

const router = Router();

router.post("/", async (req, res) => {
  const rawBody = req.body; // Buffer from express.raw()
  const headers = req.headers;

  // ── Debug: log every incoming webhook so you can see exactly what Dodo sends.
  const bodyStr = rawBody.toString("utf8");
  console.log("\n[dodo/webhook] ── incoming ──────────────────────────────");
  console.log("[dodo/webhook] webhook-id:       ", headers["webhook-id"]);
  console.log("[dodo/webhook] webhook-timestamp:", headers["webhook-timestamp"]);
  console.log("[dodo/webhook] webhook-signature:", headers["webhook-signature"]);
  console.log("[dodo/webhook] body:", bodyStr.slice(0, 500));

  // ── Parse payload first so we can respond even if sig check fails ─────────
  let event;
  try {
    event = JSON.parse(bodyStr);
  } catch {
    console.error("[dodo/webhook] Invalid JSON");
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  // ── Signature verification ─────────────────────────────────────────────────
  const sigOk = adapter.verifyWebhook(rawBody, headers);
  if (!sigOk) {
    console.warn("[dodo/webhook] Signature verification FAILED.");
    console.warn("[dodo/webhook] Check DODO_PAYMENTS_WEBHOOK_KEY matches the secret shown in the Dodo dashboard.");
    // In dev, still process but log the warning — remove this bypass in production.
    if (process.env.DODO_WEBHOOK_SKIP_SIG_VERIFY === "true") {
      console.warn("[dodo/webhook] DODO_WEBHOOK_SKIP_SIG_VERIFY=true — processing anyway (dev only)");
    } else {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  } else {
    console.log("[dodo/webhook] Signature verified ✓");
  }

  // Respond 200 immediately — Dodo retries on non-2xx.
  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      const type = event.type || event.event_type;
      console.log(`[dodo/webhook] Processing event type: ${type}`);
      if (type === "payment.succeeded") {
        await adapter.handlePaymentSucceeded(event);
      } else {
        console.log(`[dodo/webhook] Ignored event type: ${type}`);
      }
    } catch (err) {
      console.error("[dodo/webhook] Error processing event:", err.message, err.stack);
    }
  });
});

export default router;
