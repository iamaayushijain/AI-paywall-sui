import { detectBot } from './detector.js';
import { createChallengeClient } from './challenge.js';

/**
 * @param {object} config
 * @param {string} config.packageId        Deployed tollgate Move package ID (0x...)
 * @param {string} config.serverKey        SUI private key (bech32 suiprivkey1... or base64)
 * @param {"testnet"|"mainnet"|string} [config.network="testnet"]
 * @param {string} [config.rpcUrl]         Override RPC endpoint
 * @param {string[]} [config.protect]      Path globs to protect, e.g. ["/articles/*"]
 * @param {number} [config.priceMist=1000000]  Price in MIST (1 SUI = 1e9 MIST)
 * @param {string} [config.vaultId]        Optional PublisherVault object ID for split payments
 */
export function createPaywall({
  packageId,
  serverKey,
  network = 'testnet',
  rpcUrl,
  protect,
  priceMist = 1_000_000,
  vaultId,
} = {}) {
  if (!packageId) throw new Error('createPaywall requires packageId');
  if (!serverKey) throw new Error('createPaywall requires serverKey');

  const challengeClient = createChallengeClient({ packageId, serverKey, network, rpcUrl });

  const protectPatterns = (protect || []).map((p) =>
    typeof p === 'string' ? new RegExp('^' + p.replace(/\*/g, '.*') + '$') : p,
  );

  return {
    packageId,
    network,
    priceMist,
    vaultId: vaultId || null,
    isBot: (req) => detectBot(req),
    isProtected: (path) => protectPatterns.length === 0 || protectPatterns.some((p) => p.test(path)),
    challengeClient,
  };
}
