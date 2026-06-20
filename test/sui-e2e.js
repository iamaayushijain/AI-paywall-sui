/**
 * End-to-end test — SUI paywall: simple payment + split vault.
 *
 * Sections:
 *   A. Simple payment  (pay_and_unlock → PaymentVerified)
 *   B. Vault creation  (create_vault on-chain)
 *   C. Split payment   (pay_and_unlock_split → SplitPaymentReceived)
 *   D. Vault stats     (on-chain cumulative totals after payment)
 *   E. Replay guard    (same txDigest rejected a second time)
 *
 * Prerequisites:
 *   - SUI_PACKAGE_ID, SUI_SERVER_SECRET_KEY set in .env
 *   - Server running: npm run start:sui
 *   - Address funded: https://faucet.sui.io/?address=<your-address>
 */

import 'dotenv/config';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const NETWORK = process.env.SUI_NETWORK || 'testnet';
const PACKAGE_ID = process.env.SUI_PACKAGE_ID;
const CLOCK_OBJECT_ID = '0x6';

if (!PACKAGE_ID) {
  console.error('❌  SUI_PACKAGE_ID is not set. Deploy the contract first.');
  process.exit(1);
}

const suiClient = new SuiJsonRpcClient({
  url: process.env.SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK),
});

function loadKeypair() {
  const key = process.env.SUI_SERVER_SECRET_KEY;
  if (!key) throw new Error('SUI_SERVER_SECRET_KEY not set');
  if (key.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const raw = fromBase64(key);
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

async function getBalance(address) {
  const bal = await suiClient.getBalance({ owner: address });
  return Number(bal.totalBalance);
}

// ── PTB helpers ───────────────────────────────────────────────────────────────

async function submitSimplePayment({ challengeObjectId, priceMist, keypair }) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [BigInt(priceMist)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::paywall::pay_and_unlock`,
    arguments: [tx.object(challengeObjectId), coin, tx.object(CLOCK_OBJECT_ID)],
  });
  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });
  if (result.effects?.status?.status !== 'success') {
    throw new Error(`pay_and_unlock failed: ${JSON.stringify(result.effects?.status)}`);
  }
  return result.digest;
}

async function submitSplitPayment({ challengeObjectId, vaultObjectId, priceMist, keypair }) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [BigInt(priceMist)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::vault::pay_and_unlock_split`,
    arguments: [
      tx.object(challengeObjectId),
      tx.object(vaultObjectId),
      coin,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
  if (result.effects?.status?.status !== 'success') {
    throw new Error(`pay_and_unlock_split failed: ${JSON.stringify(result.effects?.status)}`);
  }
  return result.digest;
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== SUI Paywall End-to-End Test ===\n');

  const keypair = loadKeypair();
  const agentAddress = keypair.toSuiAddress();

  // ── 0. Balance check ──────────────────────────────────────────────────────
  console.log('0. Checking balance...');
  const balance = await getBalance(agentAddress);
  console.log(`  Address: ${agentAddress}`);
  console.log(`  Balance: ${(balance / 1e9).toFixed(6)} SUI`);
  if (balance < 5_000_000) throw new Error('Insufficient balance. Run: sui client faucet');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A — Simple payment
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section A: Simple payment (pay_and_unlock) ──\n');

  console.log('A1. Requesting as bot → expect 402...');
  const r402 = await fetch(`${BASE_URL}/articles/simple-test`, {
    headers: { 'User-Agent': 'GPTBot/1.0' },
  });
  if (r402.status !== 402) throw new Error(`Expected 402, got ${r402.status}`);
  const body402 = await r402.json();
  const { objectId: simChallengeId, priceMist: simPrice } = body402.challenge;
  console.log(`  Challenge: ${simChallengeId}  price: ${simPrice} MIST  mode: ${body402.mode}`);

  console.log('A2. Submitting pay_and_unlock PTB...');
  const simTxDigest = await submitSimplePayment({ challengeObjectId: simChallengeId, priceMist: simPrice, keypair });
  console.log(`  TX: ${simTxDigest}`);
  console.log(`  Explorer: https://suiscan.xyz/${NETWORK}/tx/${simTxDigest}`);

  console.log('A3. Retrying with payment headers → expect 200...');
  const r200 = await fetch(`${BASE_URL}/articles/simple-test`, {
    headers: {
      'User-Agent': 'GPTBot/1.0',
      'x-sui-payment-tx': simTxDigest,
      'x-sui-challenge-id': simChallengeId,
    },
  });
  if (r200.status !== 200) {
    const b = await r200.json();
    throw new Error(`Expected 200, got ${r200.status}: ${b.error}`);
  }
  const r200body = await r200.json();
  console.log(`  ✓ Unlocked — payer: ${r200body.payment?.payer?.slice(0, 14)}...`);
  console.log(`  ✓ Content:  "${r200body.content?.title}"`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — Vault creation
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section B: Creating PublisherVault (80/15/5 split) ──\n');

  // Pool = second keystore address; protocol = same as publisher for demo
  const POOL_ADDRESS = '0xa4f80cf7768e9cfde6b6a6adc29576eabe1addd30729eb5ef571430c49577343';
  const PROTOCOL_ADDRESS = agentAddress;

  console.log('B1. POST /sui/v1/vault/create ...');
  const vaultRes = await fetch(`${BASE_URL}/sui/v1/vault/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publisherBps: 8000,
      poolAddress: POOL_ADDRESS,
      poolBps: 1500,
      protocolAddress: PROTOCOL_ADDRESS,
      protocolBps: 500,
    }),
  });
  if (!vaultRes.ok) {
    const b = await vaultRes.json();
    throw new Error(`Vault creation failed: ${b.error}`);
  }
  const vaultBody = await vaultRes.json();
  const vaultObjectId = vaultBody.vaultObjectId;
  console.log(`  Vault ID:  ${vaultObjectId}`);
  console.log(`  Publisher: ${vaultBody.publisher?.slice(0, 14)}...  (80%)`);
  console.log(`  Pool:      ${POOL_ADDRESS.slice(0, 14)}...  (15%)`);
  console.log(`  Protocol:  ${PROTOCOL_ADDRESS.slice(0, 14)}...  (5%)`);
  console.log(`  TX:        ${vaultBody.txDigest}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C — Split payment
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section C: Split payment (pay_and_unlock_split) ──\n');

  console.log('C1. Creating challenge via API (using vault directly for split payment)...');
  // Create a fresh challenge via the API
  const chalRes = await fetch(`${BASE_URL}/sui/v1/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resource: '/articles/split-test',
      publisherAddress: agentAddress,
      priceMist: 1_000_000,
    }),
  });
  if (!chalRes.ok) throw new Error(`Challenge creation failed: ${(await chalRes.json()).error}`);
  const chalBody = await chalRes.json();
  const splitChallengeId = chalBody.challengeObjectId;
  const splitPrice = chalBody.priceMist;
  console.log(`  Challenge: ${splitChallengeId}  price: ${splitPrice} MIST`);

  console.log('C2. Submitting pay_and_unlock_split PTB...');
  const splitTxDigest = await submitSplitPayment({
    challengeObjectId: splitChallengeId,
    vaultObjectId,
    priceMist: splitPrice,
    keypair,
  });
  console.log(`  TX: ${splitTxDigest}`);
  console.log(`  Explorer: https://suiscan.xyz/${NETWORK}/tx/${splitTxDigest}`);

  console.log('C3. Verifying via POST /sui/v1/vault/verify...');
  const verRes = await fetch(`${BASE_URL}/sui/v1/vault/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txDigest: splitTxDigest,
      challengeObjectId: splitChallengeId,
      vaultObjectId,
      publisherAddress: agentAddress,
      priceMist: splitPrice,
    }),
  });
  const verBody = await verRes.json();
  if (!verBody.verified) throw new Error(`Split verification failed: ${verBody.error}`);

  console.log(`  ✓ Verified — payer: ${verBody.payer?.slice(0, 14)}...`);
  console.log(`  ✓ Total:     ${verBody.totalMist} MIST`);
  console.log(`  ✓ Publisher: ${verBody.split?.publisherMist} MIST (${verBody.split?.publisherMist / verBody.totalMist * 100}%)`);
  console.log(`  ✓ Pool:      ${verBody.split?.poolMist} MIST (${verBody.split?.poolMist / verBody.totalMist * 100}%)`);
  console.log(`  ✓ Protocol:  ${verBody.split?.protocolMist} MIST (${verBody.split?.protocolMist / verBody.totalMist * 100}%)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D — Vault stats
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section D: On-chain vault stats ──\n');

  const statsRes = await fetch(`${BASE_URL}/sui/v1/vault/${vaultObjectId}`);
  const stats = await statsRes.json();
  console.log(`  Payment count:   ${stats.paymentCount}`);
  console.log(`  Total received:  ${stats.totalReceivedMist} MIST (${stats.totalReceivedMist / 1e9} SUI)`);
  if (stats.paymentCount < 1) throw new Error('Vault stats not updated — paymentCount should be >= 1');
  console.log('  ✓ On-chain stats updated correctly');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E — Replay protection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section E: Replay protection ──\n');

  const replayRes = await fetch(`${BASE_URL}/sui/v1/vault/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txDigest: splitTxDigest,
      challengeObjectId: splitChallengeId,
      vaultObjectId,
      publisherAddress: agentAddress,
    }),
  });
  const replayBody = await replayRes.json();
  if (replayBody.verified) throw new Error('Replay protection failed — same txDigest accepted twice!');
  console.log(`  ✓ Correctly rejected: "${replayBody.error}"`);

  // ─── Health check ─────────────────────────────────────────────────────────
  console.log('\n── Health check ──');
  const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
  console.log(`  Status: ${health.status}  network: ${health.network}  package: ${health.packageId?.slice(0, 14)}...`);

  console.log('\n✅  All sections passed!\n');
  console.log(`  Hint: Set SUI_VAULT_ID=${vaultObjectId} in .env and restart`);
  console.log('  to make all bot requests use split payment automatically.\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message);
  process.exit(1);
});
