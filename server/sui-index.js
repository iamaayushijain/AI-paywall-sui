/**
 * SUI-native Tollgate server.
 *
 * Self-contained — no Supabase, no Solana. Replay protection is enforced by
 * the Move contract (consuming the challenge object is atomic on-chain).
 *
 * Required env:
 *   SUI_SERVER_SECRET_KEY  — bech32 (suiprivkey1...) or base64 keystore entry
 *   SUI_PACKAGE_ID         — 0x... address of the deployed tollgate package
 *
 * Optional env:
 *   SUI_NETWORK            — testnet (default) | mainnet | devnet
 *   SUI_RPC_URL            — override RPC endpoint
 *   SUI_PUBLISHER_ADDRESS  — who receives payments (defaults to server address)
 *   SUI_PRICE_MIST         — price per request in MIST (default 1_000_000)
 *   PORT                   — HTTP port (default 3001)
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiDetector } from './middleware/aiDetector.js';
import suiApiRoute from './routes/suiApi.js';
import suiContentRoute from './routes/suiContent.js';
import { getServerAddress, getSuiNetwork, getPackageId } from './services/suiPaywall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(aiDetector);
app.use(express.static(path.join(__dirname, '../client')));

app.use('/sui/v1', suiApiRoute);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    chain: 'sui',
    network: getSuiNetwork(),
    packageId: getPackageId() || 'NOT SET — deploy the contract first',
  });
});

// Catch-all content route — must be last
app.use(suiContentRoute);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(err.statusCode || 500).json({
    status: 'error',
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  let serverAddr = '(SUI_SERVER_SECRET_KEY not set)';
  try { serverAddr = getServerAddress(); } catch {}

  console.log(`\n  ⛓️  Tollgate SUI Server running on http://localhost:${PORT}`);
  console.log(`  🌐 Network:    SUI ${getSuiNetwork()}`);
  console.log(`  📦 Package:    ${getPackageId() || 'NOT SET'}`);
  console.log(`  🔑 Server:     ${serverAddr}`);
  console.log(`  📄 Content:    http://localhost:${PORT}/articles/test`);
  console.log(`  ℹ️  Info:       http://localhost:${PORT}/sui/v1/info`);
  console.log(`  💚 Health:     http://localhost:${PORT}/health\n`);
});
