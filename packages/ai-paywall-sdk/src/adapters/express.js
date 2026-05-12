/**
 * Express adapter.
 *
 * Two APIs:
 *
 * 1. Classic (Solana-only):
 *    import { createPaywall } from "tollgate-sdk";
 *    import { expressMiddleware } from "tollgate-sdk/express";
 *    const paywall = createPaywall({ walletAddress: "..." });
 *    app.use(expressMiddleware(paywall));
 *
 * 2. Unified (adapter-agnostic):
 *    import { paywallMiddleware } from "tollgate-sdk/express";
 *    app.use(paywallMiddleware({ adapter: "solana", walletAddress: "...", network: "mainnet-beta" }));
 *    app.use(paywallMiddleware({ adapter: "dodo",   publisherId: "my-site", price: 0.01 }));
 *
 * The default adapter is "solana" — existing users are unaffected.
 */

import { createPaywall } from "../index.js";
import { dodoMiddleware } from "./dodo.js";

/**
 * Unified paywall middleware factory.
 *
 * @param {object} options
 * @param {'solana'|'dodo'} [options.adapter='solana']  Payment adapter to use.
 *
 * Solana options:
 * @param {string} options.walletAddress  Solana wallet that receives USDC.
 * @param {string} [options.network]      'devnet' | 'mainnet-beta'
 * @param {number} [options.price]        Alias for basePriceMicroUsdc (in micro-USDC).
 *
 * Dodo options:
 * @param {string} options.publisherId    Any opaque publisher identifier.
 * @param {number} [options.price=0.01]   Price per access in USD.
 *
 * Shared options:
 * @param {string[]} [options.protect]    Path glob patterns.
 * @param {string}   [options.apiUrl]     Override facilitator URL.
 * @param {boolean}  [options.failOpen]   Pass through if payment system is down.
 * @param {Function} [options.onDetection] Called with bot detection result.
 */
export function paywallMiddleware(options = {}) {
  const { adapter = "solana", price, ...rest } = options;

  if (adapter === "dodo") {
    return dodoMiddleware({ price, ...rest });
  }

  // Default: Solana path. Internally wraps createPaywall() + expressMiddleware().
  const solanaConfig = {
    ...rest,
    ...(price !== undefined ? { basePriceMicroUsdc: price } : {}),
  };
  const paywall = createPaywall(solanaConfig);
  return expressMiddleware(paywall);
}

export function expressMiddleware(paywall, overrides = {}) {
  return async function paywallMiddleware(req, res, next) {
    try {
      const verdict = await paywall.run({
        method: req.method,
        pathname: req.originalUrl?.split("?")[0] || req.path,
        headers: req.headers,
      });

      if (verdict.kind === "passthrough") {
        if (verdict.payment) req.paywallPayment = verdict.payment;
        return next();
      }

      res.status(verdict.status);
      Object.entries(verdict.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
      res.json(verdict.body);
    } catch (err) {
      next(err);
    }
    // overrides currently reserved for future per-mount configuration.
    void overrides;
  };
}
