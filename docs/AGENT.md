# ai-paywall-agent-sdk-sui — Agent Guide (SUI)

Drop-in `fetch()` replacement for AI agents. Automatically detects, pays, and retries
SUI HTTP 402 paywalls. Builds `pay_and_unlock` PTBs with configurable MIST budget caps.

## Installation

```bash
npm install ai-paywall-agent-sdk-sui @mysten/sui
```

---

## Quick Start

```js
import { createSuiAgentClient, fromKeypairFile } from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(),        // reads ~/.sui/sui_config/sui.keystore
  maxPerRequestMist: 10_000_000,    // hard cap: 0.01 SUI per request
  maxTotalMist: 1_000_000_000,      // session budget: 1 SUI

  onPayment: (p) => console.log("paid:", p.txDigest, p.priceMist, "MIST"),
});

// Drop-in fetch — 402s paid automatically
const res = await client.fetch("https://publisher.com/articles/ai-trends");
const data = await res.json();

// Running spend total in MIST
console.log("spent:", client.spend(), "MIST");

// Agent's SUI address
console.log("address:", client.address());
```

---

## Fund the Agent Address

The agent needs SUI to pay gas and content prices.

```bash
# Testnet faucet
sui client faucet
# Or visit: https://faucet.sui.io/?address=<your-address>
```

---

## Signers

| Helper | Source |
|--------|--------|
| `fromKeypairFile()` | `~/.sui/sui_config/sui.keystore` (SUI CLI default) |
| `fromKeypairFile(path)` | Custom keystore path |
| `fromSecretKeyBech32(key)` | `suiprivkey1...` from `sui keytool export` |
| `fromSecretKeyBase64(key)` | Raw base64 from keystore array |
| `fromKeypair(kp)` | Existing `Ed25519Keypair` instance |

---

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `signer` | **required** | Ed25519Keypair from one of the signer helpers |
| `network` | `"testnet"` | `"testnet"` or `"mainnet"` |
| `rpcUrl` | public RPC | Override SUI RPC endpoint |
| `maxPerRequestMist` | unlimited | Hard cap per payment — throws `BudgetExceededError` if exceeded |
| `maxTotalMist` | unlimited | Session budget cap |
| `onPayment(info)` | — | Callback after each payment: `{ txDigest, priceMist, challengeObjectId }` |

---

## Vault (Split) Mode

When the publisher has a `PublisherVault` configured, the 402 body includes
`challenge.vaultObjectId`. The agent SDK detects this automatically and calls
`pay_and_unlock_split` instead of `pay_and_unlock`. No extra config required.

```js
const res = await client.fetch("https://publisher.com/premium/report");
const data = await res.json();

// In vault mode, the payment is atomically split:
// { publisherMist: 800000, poolMist: 150000, protocolMist: 50000 }
console.log(data.payment?.split);
```

---

## Error Handling

```js
import {
  BudgetExceededError,
  PaymentRefusedError,
  UnsupportedChallengeError,
} from "ai-paywall-agent-sdk-sui";

try {
  const res = await client.fetch("https://publisher.com/article");
} catch (err) {
  if (err instanceof BudgetExceededError) {
    // Per-request or session budget cap hit.
  } else if (err instanceof PaymentRefusedError) {
    // pay_and_unlock TX failed on-chain (insufficient balance, challenge expired).
  } else if (err instanceof UnsupportedChallengeError) {
    // 402 body is not a Tollgate SUI challenge.
  } else {
    throw err;
  }
}
```

---

## Spend Tracking

```js
// Total MIST spent this session
console.log(client.spend()); // e.g. 3000000

// Persist across restarts with onPayment hook:
const client = createSuiAgentClient({
  signer: fromKeypairFile(),
  onPayment: async ({ txDigest, priceMist }) => {
    await db.insert({ txDigest, priceMist, ts: new Date() });
  },
});
```

---

## How It Works

1. Agent calls `client.fetch(url)` — same as global `fetch`
2. If response is 200, returned unchanged (pure passthrough)
3. If response is 402:
   - Parses `challenge.objectId`, `challenge.priceMist`, `challenge.move.target`
   - Checks `maxPerRequestMist` and `maxTotalMist` budget caps
   - Builds a PTB: `splitCoins(gas, [priceMist])` → `pay_and_unlock(challenge, coin, clock)`
   - Signs and submits the PTB to SUI
   - Retries the original request with `X-SUI-PAYMENT-TX` and `X-SUI-CHALLENGE-ID` headers
4. Returns the unlocked response
