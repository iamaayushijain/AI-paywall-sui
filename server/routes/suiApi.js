/**
 * SUI paywall API routes.
 *
 * GET  /sui/v1/info              — server config (address, package, network)
 * POST /sui/v1/challenge         — create on-chain PaywallChallenge object
 * POST /sui/v1/verify            — verify a pay_and_unlock transaction
 * POST /sui/v1/vault/create      — create a PublisherVault with split config
 * GET  /sui/v1/vault/:id         — read vault stats from chain
 * POST /sui/v1/vault/verify      — verify a pay_and_unlock_split transaction
 */

import { Router } from 'express';
import {
  createSuiChallenge,
  verifySuiPayment,
  createPublisherVault,
  getVaultStats,
  verifySplitPayment,
  getServerAddress,
  getSuiNetwork,
  getPackageId,
} from '../services/suiPaywall.js';

const router = Router();

function isSuiAddress(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{1,64}$/.test(v);
}

// ─── Server info ──────────────────────────────────────────────────────────────

router.get('/info', (_req, res) => {
  res.json({
    network: getSuiNetwork(),
    packageId: getPackageId(),
    serverAddress: getServerAddress(),
    clockObjectId: '0x6',
    vaultId: process.env.SUI_VAULT_ID || null,
  });
});

// ─── Challenge creation ───────────────────────────────────────────────────────

router.post('/challenge', async (req, res, next) => {
  try {
    const { resource, publisherAddress, priceMist } = req.body || {};

    if (!resource || typeof resource !== 'string') {
      return res.status(400).json({ error: 'resource is required' });
    }
    if (!isSuiAddress(publisherAddress)) {
      return res.status(400).json({ error: 'publisherAddress must be a valid SUI address' });
    }

    const price = Number(priceMist ?? 1_000_000);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'priceMist must be a positive number' });
    }

    const challenge = await createSuiChallenge({ resource, publisherAddress, priceMist: price });
    return res.json(challenge);
  } catch (err) {
    next(err);
  }
});

// ─── Simple payment verification ─────────────────────────────────────────────

router.post('/verify', async (req, res, next) => {
  try {
    const { txDigest, challengeObjectId, publisherAddress, priceMist } = req.body || {};

    if (!txDigest || typeof txDigest !== 'string') {
      return res.status(400).json({ error: 'txDigest is required' });
    }
    if (!isSuiAddress(challengeObjectId)) {
      return res.status(400).json({ error: 'challengeObjectId must be a valid SUI address' });
    }
    if (!isSuiAddress(publisherAddress)) {
      return res.status(400).json({ error: 'publisherAddress must be a valid SUI address' });
    }

    const result = await verifySuiPayment({
      txDigest, challengeObjectId, publisherAddress,
      priceMist: priceMist ? Number(priceMist) : undefined,
    });

    return res.status(result.verified ? 200 : 403).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Vault creation ───────────────────────────────────────────────────────────

/**
 * POST /sui/v1/vault/create
 *
 * Body: {
 *   publisherBps: number,     e.g. 8000  (80%)
 *   poolAddress: string,      SUI address for pool/DAO
 *   poolBps: number,          e.g. 1500  (15%)
 *   protocolAddress: string,  SUI address for protocol fee
 *   protocolBps: number,      e.g. 500   (5%)
 * }
 * publisherBps + poolBps + protocolBps must equal 10000.
 * The publisher address is taken from SUI_SERVER_SECRET_KEY (ctx.sender).
 */
router.post('/vault/create', async (req, res, next) => {
  try {
    const { publisherBps, poolAddress, poolBps, protocolAddress, protocolBps } = req.body || {};

    for (const [name, val] of [['publisherBps', publisherBps], ['poolBps', poolBps], ['protocolBps', protocolBps]]) {
      if (!Number.isFinite(Number(val)) || Number(val) < 0) {
        return res.status(400).json({ error: `${name} must be a non-negative number` });
      }
    }
    if (!isSuiAddress(poolAddress)) {
      return res.status(400).json({ error: 'poolAddress must be a valid SUI address' });
    }
    if (!isSuiAddress(protocolAddress)) {
      return res.status(400).json({ error: 'protocolAddress must be a valid SUI address' });
    }
    if (Number(publisherBps) + Number(poolBps) + Number(protocolBps) !== 10_000) {
      return res.status(400).json({ error: 'publisherBps + poolBps + protocolBps must equal 10000' });
    }

    const vault = await createPublisherVault({
      publisherBps: Number(publisherBps),
      poolAddress,
      poolBps: Number(poolBps),
      protocolAddress,
      protocolBps: Number(protocolBps),
    });

    return res.json({
      ...vault,
      hint: `Set SUI_VAULT_ID=${vault.vaultObjectId} in .env and restart to enable split payments`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Vault stats ──────────────────────────────────────────────────────────────

router.get('/vault/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isSuiAddress(id)) {
      return res.status(400).json({ error: 'id must be a valid SUI address' });
    }
    const stats = await getVaultStats(id);
    return res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ─── Split payment verification ───────────────────────────────────────────────

/**
 * POST /sui/v1/vault/verify
 *
 * Body: {
 *   txDigest: string,
 *   challengeObjectId: string,
 *   vaultObjectId: string,
 *   publisherAddress: string,
 *   priceMist?: number,
 * }
 */
router.post('/vault/verify', async (req, res, next) => {
  try {
    const { txDigest, challengeObjectId, vaultObjectId, publisherAddress, priceMist } = req.body || {};

    if (!txDigest || typeof txDigest !== 'string') {
      return res.status(400).json({ error: 'txDigest is required' });
    }
    if (!isSuiAddress(challengeObjectId)) {
      return res.status(400).json({ error: 'challengeObjectId must be a valid SUI address' });
    }
    if (!isSuiAddress(vaultObjectId)) {
      return res.status(400).json({ error: 'vaultObjectId must be a valid SUI address' });
    }
    if (!isSuiAddress(publisherAddress)) {
      return res.status(400).json({ error: 'publisherAddress must be a valid SUI address' });
    }

    const result = await verifySplitPayment({
      txDigest, challengeObjectId, vaultObjectId, publisherAddress,
      priceMist: priceMist ? Number(priceMist) : undefined,
    });

    return res.status(result.verified ? 200 : 403).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
