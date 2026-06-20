# ai-paywall-sdk-sui — Publisher Guide (SUI)

Drop-in HTTP 402 paywall on SUI. Gate content with Express middleware — SUI micropayments
arrive on-chain via a Move contract. No database. No API key. No custodian.

## Prerequisites

1. **SUI CLI** installed and a funded testnet address
2. **Tollgate Move package** deployed (or use the shared testnet deployment)
3. The server keypair private key

### Deploy the Move contract

```bash
cd move/tollgate
sui client publish --skip-dependency-verification
# Note the Package Object ID from the output → SUI_PACKAGE_ID
```

### Export your server private key

```bash
sui keytool export --key-identity <your-address>
# Output: suiprivkey1qr9... → set as SUI_SERVER_SECRET_KEY

# Or use the helper:
node scripts/export-sui-key.js
```

### Fund the server address

```bash
sui client faucet     # testnet
sui client balance
```

---

## Installation

```bash
npm install ai-paywall-sdk-sui @mysten/sui
```

---

## Quick Start (Express)

```js
import express from "express";
import { createPaywall } from "ai-paywall-sdk-sui";
import { expressMiddleware } from "ai-paywall-sdk-sui/express";

const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,
  serverKey: process.env.SUI_SERVER_SECRET_KEY,
  network: "testnet",
  protect: ["/articles/*", "/blog/*"],
  priceMist: 1_000_000, // 0.001 SUI per crawl
});

const app = express();
app.use(expressMiddleware(paywall));

// req.suiPayment is set when a bot paid successfully
app.get("/articles/:slug", (req, res) => {
  res.json({
    content: "Your article...",
    payment: req.suiPayment ?? null,
  });
});

app.listen(3000);
```

---

## Revenue Splitting with PublisherVault

Create a vault to automatically split payments across publisher / content pool / protocol:

```bash
# Create vault: 80% publisher / 15% pool / 5% protocol
curl -X POST http://localhost:3001/sui/v1/vault/create \
  -H "Content-Type: application/json" \
  -d '{
    "publisherBps": 8000,
    "poolAddress": "0xa4f8...",
    "poolBps": 1500,
    "protocolAddress": "0x24ae...",
    "protocolBps": 500
  }'
# Response: { "vaultObjectId": "0x...", ... }
# Set SUI_VAULT_ID in .env and restart.
```

```js
const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,
  serverKey: process.env.SUI_SERVER_SECRET_KEY,
  network: "testnet",
  priceMist: 1_000_000,
  vaultId: process.env.SUI_VAULT_ID, // enables split payments
});
```

Agents calling your gated routes will automatically use `pay_and_unlock_split` and the
payment is atomically split across all three addresses in one PTB.

---

## Configuration Reference

| Option | Default | Description |
|--------|---------|-------------|
| `packageId` | **required** | Deployed Tollgate Move package ID (0x...) |
| `serverKey` | **required** | SUI private key: bech32 (`suiprivkey1...`) or base64 |
| `network` | `"testnet"` | `"testnet"` or `"mainnet"` |
| `rpcUrl` | public RPC | Override SUI RPC endpoint |
| `protect` | `["/*"]` | Path globs to gate, e.g. `["/articles/*"]` |
| `priceMist` | `1000000` | Price per crawl in MIST (1 SUI = 1,000,000,000 MIST) |
| `vaultId` | — | PublisherVault object ID — enables split payments |

---

## How Replay Protection Works

The `PaywallChallenge` is a SUI shared object. When `pay_and_unlock` is called, the object
is consumed (deleted) atomically in the same transaction. A second attempt fails because the
object no longer exists on-chain — enforced at the Move VM level, not application code.
**No database required.**

---

## Environment Variables

```bash
# Required
SUI_PACKAGE_ID=0xff98a1daa3a52be512b85856a93e749d89bc7d86c36219d53dea54ea9b1d1f9b
SUI_SERVER_SECRET_KEY=suiprivkey1qr9vrgztfcku2a65u9zx09mr02zcd5w8xed7...

# Recommended
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_PRICE_MIST=1000000
PORT=3001

# Optional
SUI_VAULT_ID=0x...
```

> ⚠️ Never commit `SUI_SERVER_SECRET_KEY` to source control.
