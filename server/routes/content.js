import { Router } from 'express';
import {
  verifyPayment,
  getTreasuryUsdcAta,
  getUsdcMintAddress,
  getNetwork,
} from '../services/verifyPayment.js';
import { recordPayment } from '../data/payments.js';
import {
  getPriceForRequest,
  scoreRelevance,
  getContentSignals,
} from '../services/relevanceScorer.js';

const router = Router();

// Base price in micro-USDC. 1e6 micro-USDC = $1, so 1_000 = $0.001.
// Final price = BASE_PRICE_MICRO_USDC × relevance_score (1–10), i.e. $0.001 – $0.01.
// NOTE: the `lamports` column in payments.js is reused for this unit — rename later if desired.
const BASE_PRICE_MICRO_USDC = 1_000;

// x402 wire format for the `network` field.
function x402Network() {
  const n = getNetwork();
  if (n === 'mainnet-beta') return 'solana-mainnet';
  return `solana-${n}`;
}

function getPageContent(path) {
  return {
    title: `Content at ${path}`,
    body: 'This is exclusive content unlocked after x402 payment verification. '
      + 'It contains valuable data, analysis, and insights that AI agents can use.',
    path,
    timestamp: new Date().toISOString(),
  };
}

router.get('*', async (req, res, next) => {
  try {
    await handle(req, res);
  } catch (err) {
    next(err);
  }
});

async function handle(req, res) {
  if (!req.isAI) {
    return res.json({
      status: 'ok',
      message: 'Welcome, human! Content is free for you.',
      content: getPageContent(req.path),
    });
  }

  const xPayment = req.headers['x-payment'];

  if (!xPayment) {
    const price = getPriceForRequest(req.botName, req.path, '', BASE_PRICE_MICRO_USDC);
    const score = scoreRelevance(req.botName, req.path, '');
    const signals = getContentSignals(req.botName, req.path, '');

    return res.status(402).json({
      x402Version: 1,
      error: 'Payment required to access this content',
      accepts: [
        {
          scheme: 'exact',
          network: x402Network(),
          maxAmountRequired: String(price),
          resource: req.path,
          description: `AI crawler access to ${req.path}`,
          mimeType: 'application/json',
          outputSchema: null,
          payTo: getTreasuryUsdcAta(),
          maxTimeoutSeconds: 300,
          asset: getUsdcMintAddress(),
        },
      ],
      // Extension fields — not part of x402 spec but useful for relevance-aware bots.
      crawlpay: {
        relevance_score: score,
        content_signals: signals,
        base_price_micro_usdc: BASE_PRICE_MICRO_USDC,
      },
    });
  }

  // Re-score now that we have the actual content body — this is the authoritative price.
  const content = getPageContent(req.path);
  const actualPrice = getPriceForRequest(
    req.botName, req.path, content.body, BASE_PRICE_MICRO_USDC,
  );
  const score = scoreRelevance(req.botName, req.path, content.body);

  const result = await verifyPayment(xPayment, req.path, actualPrice);

  if (result.verified) {
    recordPayment({
      tx:              result.signature || `hdr_${xPayment.slice(0, 24)}`,
      botName:         req.botName,
      userAgent:       req.headers['user-agent'],
      path:            req.path,
      pageHash:        req.path,
      lamports:        result.received || actualPrice,
      relevanceScore:  score,
    });

    return res.json({
      status: 'ok',
      message: 'Payment verified. Content unlocked.',
      content,
    });
  }

  return res.status(403).json({
    status:  'forbidden',
    message: 'Payment verification failed.',
    error:   result.error,
  });
}

export default router;
