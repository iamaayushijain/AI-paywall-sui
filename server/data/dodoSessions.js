/**
 * Supabase queries for Dodo payment sessions and usage billing events.
 *
 * Tables (see supabase/dodo_schema.sql):
 *   dodo_sessions     — one row per payment session, tracks pending → paid
 *   dodo_usage_events — immutable billing log, one row per paid access
 */

import db from "./db.js";

// ─── Sessions ─────────────────────────────────────────────────────────────────

/**
 * Insert a new pending payment session.
 */
export async function createSession({
  sessionId,
  dodoSessionId,
  publisherId,
  contentId,
  amountUsd,
  expiresAt,
}) {
  const { error } = await db.from("dodo_sessions").insert({
    session_id:      sessionId,
    dodo_session_id: dodoSessionId,
    publisher_id:    publisherId,
    content_id:      contentId,
    amount_usd:      amountUsd,
    status:          "pending",
    expires_at:      expiresAt,
    created_at:      new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to create dodo session: ${error.message}`);
}

/**
 * Mark a session as paid after a payment.succeeded webhook.
 */
export async function markSessionPaid({ sessionId, dodoPaymentId, amountUsd }) {
  const { error } = await db
    .from("dodo_sessions")
    .update({
      status:          "paid",
      dodo_payment_id: dodoPaymentId,
      amount_usd:      amountUsd, // override with actual charged amount
      paid_at:         new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("status", "pending"); // guard: only advance from pending

  if (error) throw new Error(`Failed to mark session paid: ${error.message}`);
}

/**
 * Fetch a session by our internal session ID.
 * Returns null if not found.
 */
export async function getSession(sessionId) {
  const { data, error } = await db
    .from("dodo_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch session: ${error.message}`);
  return data || null;
}

// ─── Usage events (billing meter) ─────────────────────────────────────────────

/**
 * Record an immutable usage event for a paid access.
 * Called after markSessionPaid so the billing log stays consistent.
 */
export async function recordUsageEvent({
  publisherId,
  contentId,
  sessionId,
  dodoPaymentId,
  amountUsd,
  botIdentity,
}) {
  const { error } = await db.from("dodo_usage_events").insert({
    publisher_id:    publisherId,
    content_id:      contentId,
    session_id:      sessionId,
    dodo_payment_id: dodoPaymentId,
    amount_usd:      amountUsd,
    bot_identity:    botIdentity || null,
    created_at:      new Date().toISOString(),
  });

  // 23505 = unique_violation — idempotent; duplicate event from webhook retry is fine.
  if (error && error.code !== "23505") {
    throw new Error(`Failed to record usage event: ${error.message}`);
  }
}
