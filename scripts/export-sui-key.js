/**
 * Converts the active SUI keystore entry to bech32 format (suiprivkey1...)
 * for use as SUI_SERVER_SECRET_KEY in .env.
 *
 * Usage:  node scripts/export-sui-key.js
 *
 * Reads from ~/.sui/sui_config/sui.keystore (same file the CLI uses).
 * The first key in the file corresponds to the active address.
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { encodeSuiPrivateKey } from '@mysten/sui/cryptography';

const keystorePath = `${homedir()}/.sui/sui_config/sui.keystore`;

let entries;
try {
  entries = JSON.parse(readFileSync(keystorePath, 'utf8'));
} catch (err) {
  console.error(`Cannot read keystore at ${keystorePath}: ${err.message}`);
  process.exit(1);
}

if (!entries.length) {
  console.error('Keystore is empty.');
  process.exit(1);
}

// Use the first key (active address)
const raw = fromBase64(entries[0]);
const flagByte = raw[0];
const secretKey = raw.slice(1);

if (flagByte !== 0x00) {
  console.error(`Only Ed25519 keys are supported (flag byte 0x00). Got: 0x${flagByte.toString(16)}`);
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const address = keypair.toSuiAddress();
const bech32 = encodeSuiPrivateKey(secretKey, 'ED25519');

console.log('\n=== SUI Key Export ===\n');
console.log(`Address:  ${address}`);
console.log(`Bech32:   ${bech32}`);
console.log('\nAdd to .env:\n');
console.log(`SUI_SERVER_SECRET_KEY=${bech32}`);
console.log(`SUI_PUBLISHER_ADDRESS=${address}`);
console.log('');
