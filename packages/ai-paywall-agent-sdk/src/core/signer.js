import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export function fromKeypair(keypair) {
  return keypair;
}

/**
 * Load from a bech32-encoded private key (suiprivkey1...).
 * Export via: sui keytool export --key-identity <address>
 */
export function fromSecretKeyBech32(bech32Key) {
  const { secretKey } = decodeSuiPrivateKey(bech32Key);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

/**
 * Load from a base64-encoded key (as stored in sui.keystore).
 */
export function fromSecretKeyBase64(base64Key) {
  const raw = fromBase64(base64Key);
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

/**
 * Load the first keypair from ~/.sui/sui_config/sui.keystore (default SUI CLI location).
 * @param {string} [keystorePath]  Override keystore path
 */
export function fromKeypairFile(keystorePath) {
  const path = keystorePath || join(homedir(), '.sui', 'sui_config', 'sui.keystore');
  const keystore = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(keystore) || keystore.length === 0) {
    throw new Error(`No keys found in keystore at ${path}`);
  }
  const raw = fromBase64(keystore[0]);
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}
