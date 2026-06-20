/**
 * tollgate-agent-sdk — SUI paywall client for AI agents.
 *
 * Quick start:
 *
 *   import { createSuiAgentClient, fromKeypairFile } from "tollgate-agent-sdk";
 *
 *   const client = createSuiAgentClient({
 *     network: "testnet",
 *     signer: fromKeypairFile(),         // ~/.sui/sui_config/sui.keystore
 *     maxPerRequestMist: 10_000_000,     // max 0.01 SUI per request
 *     maxTotalMist: 1_000_000_000,       // session budget: 1 SUI
 *   });
 *
 *   // Drop-in fetch — auto-pays 402s and retries with payment headers
 *   const res = await client.fetch("https://publisher.com/articles/ai");
 *   const data = await res.json();
 *
 *   console.log("spent so far:", client.spend(), "MIST");
 */

export { createSuiAgentClient } from "./core/client.js";
export { fromKeypair, fromSecretKeyBech32, fromSecretKeyBase64, fromKeypairFile } from "./core/signer.js";
export { PaywallError, BudgetExceededError, PaymentRefusedError, UnsupportedChallengeError } from "./core/errors.js";
