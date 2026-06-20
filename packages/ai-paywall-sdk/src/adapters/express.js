/**
 * Express middleware for the Tollgate SUI paywall.
 *
 * Usage:
 *   import { createPaywall } from "tollgate-sdk";
 *   import { expressMiddleware } from "tollgate-sdk/express";
 *
 *   const paywall = createPaywall({ packageId, serverKey, priceMist: 1_000_000 });
 *   app.use("/articles", expressMiddleware(paywall));
 *
 *   // req.suiPayment is set on paid requests:
 *   // { verified, payer, amountMist, txDigest }
 */

export function expressMiddleware(paywall) {
  return async (req, res, next) => {
    if (!paywall.isBot(req) || !paywall.isProtected(req.path)) return next();

    const txDigest = req.headers['x-sui-payment-tx'];
    const challengeObjectId = req.headers['x-sui-challenge-id'];

    if (!txDigest) {
      let challenge;
      try {
        challenge = await paywall.challengeClient.createChallenge({
          resource: req.path,
          priceMist: paywall.priceMist,
        });
      } catch (err) {
        return res.status(503).json({ error: 'Failed to create payment challenge', detail: err.message });
      }

      const pkg = paywall.packageId;
      const isVaultMode = Boolean(paywall.vaultId);

      return res.status(402).json({
        x402Version: 1,
        error: 'Payment required',
        network: `sui-${paywall.network}`,
        mode: isVaultMode ? 'split' : 'simple',
        challenge: {
          objectId: challenge.objectId,
          publisherAddress: challenge.publisherAddress,
          priceMist: challenge.priceMist,
          priceFormatted: `${(challenge.priceMist / 1e9).toFixed(6)} SUI`,
          expiresAt: challenge.expiresAt,
          ...(isVaultMode && { vaultObjectId: paywall.vaultId }),
          move: isVaultMode
            ? {
                packageId: pkg,
                target: `${pkg}::vault::pay_and_unlock_split`,
                clockObjectId: '0x6',
                hint: 'PTB: splitCoins(gas,[priceMist]) → pay_and_unlock_split(challenge,vault,coin,clock)',
              }
            : {
                packageId: pkg,
                target: `${pkg}::paywall::pay_and_unlock`,
                clockObjectId: '0x6',
                hint: 'PTB: splitCoins(gas,[priceMist]) → pay_and_unlock(challenge,coin,clock)',
              },
        },
      });
    }

    if (!challengeObjectId) {
      return res.status(400).json({ error: 'x-sui-challenge-id header required alongside x-sui-payment-tx' });
    }

    const result = await paywall.challengeClient.verifyPayment({
      txDigest,
      challengeObjectId,
      priceMist: paywall.priceMist,
    });

    if (!result.verified) {
      return res.status(403).json({ error: result.error });
    }

    req.suiPayment = result;
    return next();
  };
}
