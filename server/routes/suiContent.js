/**
 * SUI-powered content route — supports both simple and split-vault payment modes.
 *
 * Simple mode (SUI_VAULT_ID not set):
 *   Bot receives 402 → calls pay_and_unlock → retries with X-SUI-PAYMENT-TX
 *
 * Split mode (SUI_VAULT_ID set):
 *   Bot receives 402 with vault info → calls pay_and_unlock_split
 *   → retries with X-SUI-PAYMENT-TX + X-SUI-VAULT-ID
 *   Payment is atomically split: publisher / pool / protocol in one PTB.
 *
 * Both modes use the same two request headers:
 *   X-SUI-PAYMENT-TX:   <txDigest>
 *   X-SUI-CHALLENGE-ID: <challengeObjectId>
 */

import { Router } from 'express';
import {
  createSuiChallenge,
  verifySuiPayment,
  verifySplitPayment,
  getServerAddress,
  getSuiNetwork,
  getPackageId,
} from '../services/suiPaywall.js';

const router = Router();

const PUBLISHER_ADDRESS = process.env.SUI_PUBLISHER_ADDRESS || getServerAddress();
const DEFAULT_PRICE_MIST = Number(process.env.SUI_PRICE_MIST ?? 1_000_000);
const VAULT_ID = process.env.SUI_VAULT_ID || null;
const CLOCK_OBJECT_ID = '0x6';

function getPageContent(path) {
  return {
    title: `Content at ${path}`,
    body: 'Exclusive content unlocked after SUI payment. '
      + 'This content was gated by an on-chain PaywallChallenge object — '
      + 'consuming it is the replay protection.',
    path,
    timestamp: new Date().toISOString(),
  };
}

router.get('*', async (req, res, next) => {
  try {
    if (!req.isAI) {
      return res.json({
        status: 'ok',
        message: 'Welcome, human! Content is free for you.',
        content: getPageContent(req.path),
      });
    }

    const txDigest = req.headers['x-sui-payment-tx'];
    const challengeObjectId = req.headers['x-sui-challenge-id'];

    // ── No payment headers → issue 402 with on-chain challenge ───────────────
    if (!txDigest) {
      let challenge;
      try {
        challenge = await createSuiChallenge({
          resource: req.path,
          publisherAddress: PUBLISHER_ADDRESS,
          priceMist: DEFAULT_PRICE_MIST,
        });
      } catch (err) {
        return res.status(503).json({ error: 'Failed to create payment challenge', detail: err.message });
      }

      const pkg = getPackageId();
      const isVaultMode = Boolean(VAULT_ID);

      return res.status(402).json({
        x402Version: 1,
        error: 'Payment required',
        network: `sui-${getSuiNetwork()}`,
        mode: isVaultMode ? 'split' : 'simple',
        challenge: {
          objectId: challenge.challengeObjectId,
          publisherAddress: challenge.publisherAddress,
          priceMist: challenge.priceMist,
          priceFormatted: `${(challenge.priceMist / 1e9).toFixed(6)} SUI`,
          expiresAt: challenge.expiresAt,
          ...(isVaultMode && { vaultObjectId: VAULT_ID }),
          move: isVaultMode
            ? {
                packageId: pkg,
                target: `${pkg}::vault::pay_and_unlock_split`,
                clockObjectId: CLOCK_OBJECT_ID,
                hint: 'PTB: splitCoins(gas, [priceMist]) → pay_and_unlock_split(challenge, vault, coin, clock)',
              }
            : {
                packageId: pkg,
                target: `${pkg}::paywall::pay_and_unlock`,
                clockObjectId: CLOCK_OBJECT_ID,
                hint: 'PTB: splitCoins(gas, [priceMist]) → pay_and_unlock(challenge, coin, clock)',
              },
        },
      });
    }

    // ── Payment headers present → verify ─────────────────────────────────────
    if (!challengeObjectId) {
      return res.status(400).json({
        error: 'X-SUI-CHALLENGE-ID header is required alongside X-SUI-PAYMENT-TX',
      });
    }

    // Determine vault mode from the request header (agent may override via header)
    const vaultIdFromHeader = req.headers['x-sui-vault-id'];
    const effectiveVaultId = vaultIdFromHeader || VAULT_ID;

    let result;
    if (effectiveVaultId) {
      result = await verifySplitPayment({
        txDigest,
        challengeObjectId,
        vaultObjectId: effectiveVaultId,
        publisherAddress: PUBLISHER_ADDRESS,
        priceMist: DEFAULT_PRICE_MIST,
      });
    } else {
      result = await verifySuiPayment({
        txDigest,
        challengeObjectId,
        publisherAddress: PUBLISHER_ADDRESS,
        priceMist: DEFAULT_PRICE_MIST,
      });
    }

    if (!result.verified) {
      return res.status(403).json({
        status: 'forbidden',
        message: 'Payment verification failed.',
        error: result.error,
      });
    }

    return res.json({
      status: 'ok',
      message: 'Payment verified. Content unlocked.',
      payment: effectiveVaultId
        ? {
            mode: 'split',
            payer: result.payer,
            totalMist: result.totalMist,
            split: result.split,
            txDigest: result.txDigest,
            network: result.network,
          }
        : {
            mode: 'simple',
            payer: result.payer,
            amountMist: result.amountMist,
            txDigest: result.txDigest,
            network: result.network,
          },
      content: getPageContent(req.path),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
