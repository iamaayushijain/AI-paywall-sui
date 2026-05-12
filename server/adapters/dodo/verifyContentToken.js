/**
 * verifyContentToken — Express middleware
 *
 * Reads x-tollgate-token from the request, verifies the JWT signature,
 * checks the session is paid and not expired in Supabase, then attaches
 * session data to req.tollgate before calling next().
 *
 * Usage (in publisher's server using the Dodo adapter):
 *   import { verifyContentToken } from "tollgate-sdk/dodo";
 *   app.use("/gated/*", verifyContentToken);
 *
 * Or inside the dodo paywallMiddleware (handles it automatically).
 */

import { verifyJwt } from "./DodoPaymentAdapter.js";
import { getSession } from "../../data/dodoSessions.js";

export async function verifyContentToken(req, res, next) {
  const token = req.headers["x-tollgate-token"];
  if (!token) {
    return res.status(402).json({
      error: "Payment required",
      hint: "Include x-tollgate-token header obtained after completing Dodo payment",
    });
  }

  let payload;
  try {
    payload = verifyJwt(token);
  } catch (err) {
    return res.status(401).json({ error: `Invalid token: ${err.message}` });
  }

  // Cross-check against Supabase to guard against revoked / unexpired sessions.
  let session;
  try {
    session = await getSession(payload.sub);
  } catch (err) {
    console.error("[verifyContentToken] DB error:", err.message);
    return res.status(503).json({ error: "Could not verify payment session" });
  }

  if (!session) {
    return res.status(401).json({ error: "Session not found" });
  }
  if (session.status !== "paid") {
    return res.status(402).json({
      error: "Session not paid",
      sessionId: payload.sub,
      status: session.status,
    });
  }
  if (new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: "Session expired" });
  }

  // Attach verified session data for downstream handlers.
  req.tollgate = {
    sessionId:   payload.sub,
    publisherId: payload.publisherId,
    contentId:   payload.contentId,
    amountUsd:   payload.amountUsd,
    adapter:     "dodo",
  };

  next();
}
