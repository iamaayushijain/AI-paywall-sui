import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { BudgetExceededError, PaymentRefusedError, UnsupportedChallengeError } from './errors.js';

const CLOCK = '0x6';

/**
 * Create a fetch-compatible SUI paywall client.
 *
 * @param {object} opts
 * @param {object} opts.signer              Ed25519Keypair (from signer helpers)
 * @param {"testnet"|"mainnet"|string} [opts.network="testnet"]
 * @param {string} [opts.rpcUrl]            Override SUI RPC URL
 * @param {number} [opts.maxPerRequestMist] Hard cap per single payment (in MIST)
 * @param {number} [opts.maxTotalMist]      Session budget cap (in MIST)
 * @param {Function} [opts.onPayment]       Callback called after each payment
 *
 * @returns {{ fetch, spend, address }}
 */
export function createSuiAgentClient({
  signer,
  network = 'testnet',
  rpcUrl,
  maxPerRequestMist,
  maxTotalMist,
  onPayment,
} = {}) {
  if (!signer) throw new Error('createSuiAgentClient requires signer');

  const suiClient = new SuiJsonRpcClient({ url: rpcUrl || getJsonRpcFullnodeUrl(network) });
  let totalSpentMist = 0;

  async function payChallenge(body) {
    const { challenge } = body;
    if (!challenge?.objectId || !challenge?.move?.target) {
      throw new UnsupportedChallengeError('402 body is not a SUI Tollgate challenge');
    }

    const priceMist = challenge.priceMist;
    if (maxPerRequestMist != null && priceMist > maxPerRequestMist) {
      throw new BudgetExceededError(
        `Price ${priceMist} MIST exceeds per-request cap of ${maxPerRequestMist} MIST`,
      );
    }
    if (maxTotalMist != null && totalSpentMist + priceMist > maxTotalMist) {
      throw new BudgetExceededError(
        `Would exceed total budget of ${maxTotalMist} MIST (already spent ${totalSpentMist} MIST)`,
      );
    }

    const isVaultMode = Boolean(challenge.vaultObjectId);
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [BigInt(priceMist)]);

    if (isVaultMode) {
      tx.moveCall({
        target: challenge.move.target,
        arguments: [
          tx.object(challenge.objectId),
          tx.object(challenge.vaultObjectId),
          coin,
          tx.object(CLOCK),
        ],
      });
    } else {
      tx.moveCall({
        target: challenge.move.target,
        arguments: [tx.object(challenge.objectId), coin, tx.object(CLOCK)],
      });
    }

    const result = await suiClient.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new PaymentRefusedError(
        `pay_and_unlock TX failed: ${JSON.stringify(result.effects?.status)}`,
      );
    }

    totalSpentMist += priceMist;
    onPayment?.({ txDigest: result.digest, priceMist, challengeObjectId: challenge.objectId });

    return {
      txDigest: result.digest,
      challengeObjectId: challenge.objectId,
      vaultObjectId: challenge.vaultObjectId || null,
    };
  }

  /**
   * Drop-in fetch replacement that automatically handles SUI HTTP 402 challenges.
   * On a 402, parses the challenge, builds and submits a PTB, then retries with
   * X-SUI-PAYMENT-TX and X-SUI-CHALLENGE-ID headers.
   */
  async function fetch(url, options) {
    const r1 = await globalThis.fetch(url, options);
    if (r1.status !== 402) return r1;

    let body;
    try { body = await r1.json(); }
    catch { throw new PaymentRefusedError('Could not parse 402 response body as JSON'); }

    const payment = await payChallenge(body);

    const retryHeaders = {
      ...(options?.headers || {}),
      'x-sui-payment-tx': payment.txDigest,
      'x-sui-challenge-id': payment.challengeObjectId,
      ...(payment.vaultObjectId ? { 'x-sui-vault-id': payment.vaultObjectId } : {}),
    };

    return globalThis.fetch(url, { ...options, headers: retryHeaders });
  }

  return {
    fetch,
    /** Total MIST spent this session */
    spend: () => totalSpentMist,
    /** SUI address of the paying agent */
    address: () => signer.toSuiAddress(),
  };
}
