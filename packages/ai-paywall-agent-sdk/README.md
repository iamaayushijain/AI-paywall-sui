# ai-paywall-agent-sdk-sui

Drop-in `fetch()` replacement for AI agents. Automatically detects, pays, and retries
SUI HTTP 402 paywalls via `pay_and_unlock` Programmable Transaction Blocks.

## Install

```bash
npm install ai-paywall-agent-sdk-sui @mysten/sui
```

## Quick Start

```js
import { createSuiAgentClient, fromKeypairFile } from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(),       // ~/.sui/sui_config/sui.keystore
  maxPerRequestMist: 10_000_000,   // hard cap: 0.01 SUI/request
  maxTotalMist: 1_000_000_000,     // session budget: 1 SUI
});

// Drop-in fetch — 402s paid automatically
const res = await client.fetch("https://publisher.com/articles/ai-trends");
const data = await res.json();

console.log("spent:", client.spend(), "MIST");
console.log("address:", client.address());
```

## How It Works

On a 402:
1. Parses `challenge.objectId`, `challenge.priceMist`, `challenge.move.target`
2. Checks budget caps (throws `BudgetExceededError` if exceeded)
3. Builds PTB: `splitCoins(gas, [priceMist])` → `pay_and_unlock(challenge, coin, clock)`
4. Retries with `X-SUI-PAYMENT-TX` + `X-SUI-CHALLENGE-ID` headers
5. Returns the unlocked response

Vault (split) mode is detected automatically from the 402 body — no extra config.

## Error Handling

```js
import { BudgetExceededError, PaymentRefusedError } from "ai-paywall-agent-sdk-sui";

try {
  const res = await client.fetch(url);
} catch (err) {
  if (err instanceof BudgetExceededError) { /* cap hit */ }
  if (err instanceof PaymentRefusedError) { /* TX failed on-chain */ }
}
```

## Full Documentation

See [docs/AGENT.md](../../docs/AGENT.md) or the Tollgate website.

## License

MIT
