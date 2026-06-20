/**
 * Manual payment helper for demo.
 *
 * Usage:
 *   node scripts/pay-challenge.js <challengeObjectId> [priceMist]
 *
 * Example:
 *   node scripts/pay-challenge.js 0xabc123... 1000000
 */

import 'dotenv/config';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';

const challengeObjectId = process.argv[2];
const priceMist = BigInt(process.argv[3] ?? '1000000');

if (!challengeObjectId || !challengeObjectId.startsWith('0x')) {
  console.error('\nUsage: node scripts/pay-challenge.js <challengeObjectId> [priceMist]\n');
  process.exit(1);
}

const PACKAGE_ID = process.env.SUI_PACKAGE_ID;
const NETWORK    = process.env.SUI_NETWORK || 'testnet';
const CLOCK      = '0x6';
const EXPLORER   = `https://suiscan.xyz/${NETWORK}/tx`;

if (!PACKAGE_ID) {
  console.error('\nSUI_PACKAGE_ID is not set in .env\n');
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

async function main() {
  const keypair = loadKeypair();
  const address = keypair.toSuiAddress();

  console.log(`\nPaying challenge on SUI ${NETWORK}...`);
  console.log(`  Payer:     ${address}`);
  console.log(`  Challenge: ${challengeObjectId}`);
  console.log(`  Price:     ${priceMist} MIST  (${Number(priceMist) / 1e9} SUI)`);
  console.log(`  Target:    ${PACKAGE_ID}::paywall::pay_and_unlock\n`);

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [priceMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::paywall::pay_and_unlock`,
    arguments: [tx.object(challengeObjectId), coin, tx.object(CLOCK)],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer:      keypair,
    transaction: tx,
    options:     { showEffects: true, showEvents: true },
  });

  if (result.effects?.status?.status !== 'success') {
    console.error('Transaction failed:', JSON.stringify(result.effects?.status, null, 2));
    process.exit(1);
  }

  const txDigest = result.digest;
  const event    = result.events?.find((e) => e.type?.endsWith('::paywall::PaymentVerified'));

  console.log('✓ Transaction SUCCESS\n');
  console.log(`  TX Digest:   ${txDigest}`);
  console.log(`  Explorer:    ${EXPLORER}/${txDigest}`);
  if (event?.parsedJson) {
    console.log(`  Payer:       ${event.parsedJson.payer}`);
    console.log(`  Publisher:   ${event.parsedJson.publisher}`);
    console.log(`  Amount:      ${event.parsedJson.amount_mist} MIST`);
    console.log(`  Resource:    ${event.parsedJson.resource}`);
  }

  console.log('\n--- Copy these for the next curl command ---');
  console.log(`x-sui-payment-tx:   ${txDigest}`);
  console.log(`x-sui-challenge-id: ${challengeObjectId}`);
  console.log('-------------------------------------------\n');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
