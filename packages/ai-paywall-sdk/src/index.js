/**
 * tollgate-sdk — SUI on-chain HTTP 402 paywall for publishers.
 *
 * Quick start (Express):
 *   import { createPaywall } from "tollgate-sdk";
 *   import { expressMiddleware } from "tollgate-sdk/express";
 *
 *   const paywall = createPaywall({
 *     packageId: process.env.SUI_PACKAGE_ID,
 *     serverKey: process.env.SUI_SERVER_SECRET_KEY,
 *     network: "testnet",
 *     priceMist: 1_000_000,   // 0.001 SUI per request
 *   });
 *   app.use("/articles", expressMiddleware(paywall));
 *
 * Payments are SUI (MIST) settled on-chain via a PaywallChallenge shared object.
 * No API key. No custodian. Replay protection is intrinsic — consuming the
 * challenge object on-chain atomically.
 */

export { createPaywall } from "./core/paywall.js";
export { detectBot } from "./core/detector.js";
export { createChallengeClient } from "./core/challenge.js";
