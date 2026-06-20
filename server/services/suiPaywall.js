/**
 * Trustless SUI on-chain paywall facilitator — simple payment + split vault.
 *
 * Simple path:  create_challenge → pay_and_unlock → PaymentVerified event
 * Split path:   create_challenge + create_vault → pay_and_unlock_split
 *               → SplitPaymentReceived event (publisher/pool/protocol shares)
 *
 * Replay protection in both paths: consuming the challenge object on-chain is
 * atomic — a second attempt with the same ID fails because the object is gone.
 * The usedDigests set guards against a race on the server's verify endpoint.
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const NETWORK = process.env.SUI_NETWORK || 'testnet';
const PACKAGE_ID = process.env.SUI_PACKAGE_ID;
const CLOCK_OBJECT_ID = '0x6';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const usedDigests = new Set();

export const suiClient = new SuiJsonRpcClient({
  url: process.env.SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK),
});

function loadServerKeypair() {
  const key = process.env.SUI_SERVER_SECRET_KEY;
  if (!key) throw new Error('SUI_SERVER_SECRET_KEY is not set in environment');
  if (key.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const raw = fromBase64(key);
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

let _serverKeypair;
function getServerKeypair() {
  if (!_serverKeypair) _serverKeypair = loadServerKeypair();
  return _serverKeypair;
}

export function getServerAddress() {
  return getServerKeypair().toSuiAddress();
}

const normalize = (addr) => {
  try { return normalizeSuiAddress(addr || '').toLowerCase(); } catch { return (addr || '').toLowerCase(); }
};

// ─── Challenge creation ───────────────────────────────────────────────────────

/**
 * Create an on-chain PaywallChallenge shared object.
 * Waits for checkpointing before returning so agents can use the ID immediately.
 */
export async function createSuiChallenge({ resource, publisherAddress, priceMist }) {
  if (!PACKAGE_ID) throw new Error('SUI_PACKAGE_ID is not set');

  const keypair = getServerKeypair();
  const expiresAtMs = BigInt(Date.now() + CHALLENGE_TTL_MS);

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::paywall::create_challenge`,
    arguments: [
      tx.pure.vector('u8', Array.from(Buffer.from(resource, 'utf8'))),
      tx.pure.address(publisherAddress),
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
  if (!created) throw new Error('PaywallChallenge object not found in tx output');

  await suiClient.waitForTransaction({ digest: result.digest });

  return {
    challengeObjectId: created.objectId,
    publisherAddress,
    priceMist: Number(priceMist),
    expiresAt: new Date(Number(expiresAtMs)).toISOString(),
    network: NETWORK,
    packageId: PACKAGE_ID,
    creationTxDigest: result.digest,
  };
}

// ─── Simple payment verification ─────────────────────────────────────────────

/**
 * Verify a pay_and_unlock transaction by reading the PaymentVerified event.
 */
export async function verifySuiPayment({ txDigest, challengeObjectId, publisherAddress, priceMist }) {
  if (!txDigest || !challengeObjectId) {
    return { verified: false, error: 'txDigest and challengeObjectId are required' };
  }

  if (usedDigests.has(txDigest)) {
    return { verified: false, error: 'Replay: this transaction has already been verified' };
  }

  try {
    await suiClient.waitForTransaction({ digest: txDigest });
  } catch (err) {
    return { verified: false, error: `Transaction not found: ${err.message}` };
  }

  let txBlock;
  try {
    txBlock = await suiClient.getTransactionBlock({
      digest: txDigest,
      options: { showEvents: true, showEffects: true },
    });
  } catch (err) {
    return { verified: false, error: `Failed to fetch transaction: ${err.message}` };
  }

  if (!txBlock) return { verified: false, error: `Transaction ${txDigest} not found on ${NETWORK}` };

  if (txBlock.effects?.status?.status !== 'success') {
    return { verified: false, error: `Transaction failed on-chain: ${txBlock.effects?.status?.error || 'unknown'}` };
  }

  const event = (txBlock.events || []).find((e) => e.type?.endsWith('::paywall::PaymentVerified'));
  if (!event) return { verified: false, error: 'PaymentVerified event not found in transaction' };

  const { challenge_id, payer, publisher, resource, amount_mist } = event.parsedJson;

  if (normalize(challenge_id) !== normalize(challengeObjectId)) {
    return { verified: false, error: `Challenge ID mismatch: expected ${challengeObjectId}, got ${challenge_id}` };
  }
  if (normalize(publisher) !== normalize(publisherAddress)) {
    return { verified: false, error: `Publisher mismatch: expected ${publisherAddress}, got ${publisher}` };
  }

  const received = Number(amount_mist);
  if (priceMist && received < Number(priceMist)) {
    return { verified: false, error: `Underpaid: received ${received} MIST, required ${priceMist}` };
  }

  usedDigests.add(txDigest);
  return { verified: true, payer, publisher, resource, amountMist: received, txDigest, network: NETWORK };
}

// ─── Vault creation ───────────────────────────────────────────────────────────

/**
 * Create a PublisherVault on-chain with a split configuration.
 *
 * @param publisherBps   publisher's share in basis points (e.g. 8000 = 80%)
 * @param poolAddress    content pool / DAO address
 * @param poolBps        pool share in basis points
 * @param protocolAddress protocol fee address
 * @param protocolBps    protocol share in basis points
 *                       publisherBps + poolBps + protocolBps must equal 10000
 */
export async function createPublisherVault({
  publisherBps,
  poolAddress,
  poolBps,
  protocolAddress,
  protocolBps,
}) {
  if (!PACKAGE_ID) throw new Error('SUI_PACKAGE_ID is not set');
  if (publisherBps + poolBps + protocolBps !== 10_000) {
    throw new Error('publisherBps + poolBps + protocolBps must equal 10000');
  }

  const keypair = getServerKeypair();
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::vault::create_vault`,
    arguments: [
      tx.pure.u64(BigInt(publisherBps)),
      tx.pure.address(poolAddress),
      tx.pure.u64(BigInt(poolBps)),
      tx.pure.address(protocolAddress),
      tx.pure.u64(BigInt(protocolBps)),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showObjectChanges: true, showEffects: true },
  });

  if (result.effects?.status?.status !== 'success') {
    throw new Error(`Vault creation failed: ${JSON.stringify(result.effects?.status)}`);
  }

  const created = result.objectChanges?.find(
    (c) => c.type === 'created' && c.objectType?.includes('::vault::PublisherVault'),
  );
  if (!created) throw new Error('PublisherVault object not found in tx output');

  await suiClient.waitForTransaction({ digest: result.digest });

  return {
    vaultObjectId: created.objectId,
    publisher: getServerAddress(),
    publisherBps,
    poolAddress,
    poolBps,
    protocolAddress,
    protocolBps,
    txDigest: result.digest,
  };
}

/**
 * Read the current stats of a vault from chain.
 */
export async function getVaultStats(vaultObjectId) {
  const obj = await suiClient.getObject({
    id: vaultObjectId,
    options: { showContent: true },
  });

  if (!obj.data) throw new Error(`Vault ${vaultObjectId} not found`);

  const fields = obj.data.content?.fields || {};
  return {
    vaultObjectId,
    publisher: fields.publisher,
    publisherBps: Number(fields.publisher_bps),
    poolAddress: fields.pool_address,
    poolBps: Number(fields.pool_bps),
    protocolAddress: fields.protocol_address,
    protocolBps: Number(fields.protocol_bps),
    totalReceivedMist: Number(fields.total_received_mist),
    paymentCount: Number(fields.payment_count),
  };
}

// ─── Split payment verification ───────────────────────────────────────────────

/**
 * Verify a pay_and_unlock_split transaction by reading the SplitPaymentReceived event.
 */
export async function verifySplitPayment({
  txDigest,
  challengeObjectId,
  vaultObjectId,
  publisherAddress,
  priceMist,
}) {
  if (!txDigest || !challengeObjectId || !vaultObjectId) {
    return { verified: false, error: 'txDigest, challengeObjectId, and vaultObjectId are required' };
  }

  if (usedDigests.has(txDigest)) {
    return { verified: false, error: 'Replay: this transaction has already been verified' };
  }

  try {
    await suiClient.waitForTransaction({ digest: txDigest });
  } catch (err) {
    return { verified: false, error: `Transaction not found: ${err.message}` };
  }

  let txBlock;
  try {
    txBlock = await suiClient.getTransactionBlock({
      digest: txDigest,
      options: { showEvents: true, showEffects: true },
    });
  } catch (err) {
    return { verified: false, error: `Failed to fetch transaction: ${err.message}` };
  }

  if (!txBlock) return { verified: false, error: `Transaction ${txDigest} not found on ${NETWORK}` };

  if (txBlock.effects?.status?.status !== 'success') {
    return { verified: false, error: `Transaction failed on-chain: ${txBlock.effects?.status?.error || 'unknown'}` };
  }

  const event = (txBlock.events || []).find((e) => e.type?.endsWith('::vault::SplitPaymentReceived'));
  if (!event) return { verified: false, error: 'SplitPaymentReceived event not found in transaction' };

  const {
    vault_id, challenge_id, payer, publisher,
    total_mist, publisher_mist, pool_mist, protocol_mist,
  } = event.parsedJson;

  if (normalize(challenge_id) !== normalize(challengeObjectId)) {
    return { verified: false, error: `Challenge ID mismatch: expected ${challengeObjectId}, got ${challenge_id}` };
  }
  if (normalize(vault_id) !== normalize(vaultObjectId)) {
    return { verified: false, error: `Vault ID mismatch: expected ${vaultObjectId}, got ${vault_id}` };
  }
  if (normalize(publisher) !== normalize(publisherAddress)) {
    return { verified: false, error: `Publisher mismatch: expected ${publisherAddress}, got ${publisher}` };
  }

  const totalReceived = Number(total_mist);
  if (priceMist && totalReceived < Number(priceMist)) {
    return { verified: false, error: `Underpaid: received ${totalReceived} MIST, required ${priceMist}` };
  }

  usedDigests.add(txDigest);
  return {
    verified: true,
    payer,
    publisher,
    totalMist: totalReceived,
    split: {
      publisherMist: Number(publisher_mist),
      poolMist: Number(pool_mist),
      protocolMist: Number(protocol_mist),
    },
    txDigest,
    network: NETWORK,
  };
}

export function getSuiNetwork() { return NETWORK; }
export function getPackageId() { return PACKAGE_ID; }
export { CLOCK_OBJECT_ID };
