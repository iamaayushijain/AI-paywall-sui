import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const CLOCK = '0x6';
const TTL_MS = 5 * 60 * 1000;

function loadKeypair(key) {
  if (key.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const raw = fromBase64(key);
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

const normalize = (a) => {
  try { return normalizeSuiAddress(a || '').toLowerCase(); } catch { return (a || '').toLowerCase(); }
};

/**
 * Build a low-level challenge/verify client bound to a specific SUI keypair.
 * Used internally by createPaywall and expressMiddleware.
 */
export function createChallengeClient({ packageId, serverKey, network, rpcUrl }) {
  const suiClient = new SuiJsonRpcClient({
    url: rpcUrl || getJsonRpcFullnodeUrl(network || 'testnet'),
  });
  const keypair = loadKeypair(serverKey);
  const serverAddress = keypair.toSuiAddress();
  const usedDigests = new Set();

  async function createChallenge({ resource, priceMist }) {
    const expiresAtMs = BigInt(Date.now() + TTL_MS);
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::paywall::create_challenge`,
      arguments: [
        tx.pure.vector('u8', Array.from(Buffer.from(resource, 'utf8'))),
        tx.pure.address(serverAddress),
        tx.pure.u64(BigInt(priceMist)),
        tx.pure.u64(expiresAtMs),
      ],
    });

    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true, showEffects: true },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Challenge creation failed: ${JSON.stringify(result.effects?.status)}`);
    }

    const created = result.objectChanges?.find(
      (c) => c.type === 'created' && c.objectType?.includes('::paywall::PaywallChallenge'),
    );
    if (!created) throw new Error('PaywallChallenge not found in tx output');

    await suiClient.waitForTransaction({ digest: result.digest });

    return {
      objectId: created.objectId,
      publisherAddress: serverAddress,
      priceMist: Number(priceMist),
      expiresAt: new Date(Number(expiresAtMs)).toISOString(),
      packageId,
      network: network || 'testnet',
    };
  }

  async function verifyPayment({ txDigest, challengeObjectId, priceMist }) {
    if (usedDigests.has(txDigest)) {
      return { verified: false, error: 'Replay: transaction already redeemed' };
    }

    try { await suiClient.waitForTransaction({ digest: txDigest }); }
    catch (e) { return { verified: false, error: `TX not found: ${e.message}` }; }

    let txBlock;
    try {
      txBlock = await suiClient.getTransactionBlock({
        digest: txDigest,
        options: { showEvents: true, showEffects: true },
      });
    } catch (e) {
      return { verified: false, error: `Failed to fetch TX: ${e.message}` };
    }

    if (txBlock?.effects?.status?.status !== 'success') {
      return { verified: false, error: 'TX failed on-chain' };
    }

    const event = (txBlock.events || []).find((e) => e.type?.endsWith('::paywall::PaymentVerified'));
    if (!event) return { verified: false, error: 'PaymentVerified event not found' };

    const { challenge_id, payer, publisher, amount_mist } = event.parsedJson;

    if (normalize(challenge_id) !== normalize(challengeObjectId)) {
      return { verified: false, error: `Challenge ID mismatch` };
    }
    if (normalize(publisher) !== normalize(serverAddress)) {
      return { verified: false, error: `Publisher mismatch` };
    }
    if (priceMist && Number(amount_mist) < Number(priceMist)) {
      return { verified: false, error: `Underpaid: received ${amount_mist}, required ${priceMist}` };
    }

    usedDigests.add(txDigest);
    return { verified: true, payer, amountMist: Number(amount_mist), txDigest };
  }

  return { createChallenge, verifyPayment, serverAddress };
}
