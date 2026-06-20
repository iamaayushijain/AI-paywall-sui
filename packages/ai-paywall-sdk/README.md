# ai-paywall-sdk-sui

Drop-in HTTP 402 AI paywall on SUI. Gate content with two lines of Express middleware —
SUI micropayments arrive on-chain via a Move contract. No database. No API key. No custodian.

## Install

```bash
npm install ai-paywall-sdk-sui @mysten/sui
```

## Quick Start

```js
import { createPaywall } from "ai-paywall-sdk-sui";
import { expressMiddleware } from "ai-paywall-sdk-sui/express";

const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,       // deployed Move package
  serverKey: process.env.SUI_SERVER_SECRET_KEY, // bech32 or base64 private key
  network: "testnet",
  protect: ["/articles/*"],
  priceMist: 1_000_000, // 0.001 SUI per crawl
});

app.use(expressMiddleware(paywall));

// req.suiPayment is set when a bot paid
app.get("/articles/:slug", (req, res) => {
  res.json({ content: "...", payer: req.suiPayment?.payer });
});
```

## How It Works

1. Bot hits your route → SDK creates a `PaywallChallenge` shared object on SUI → returns HTTP 402
2. Agent parses the 402, builds a `pay_and_unlock` PTB, submits it to SUI
3. Agent retries with `X-SUI-PAYMENT-TX` and `X-SUI-CHALLENGE-ID` headers
4. SDK reads the `PaymentVerified` event on-chain → content unlocked

Replay protection is intrinsic: consuming the challenge object atomically deletes it.

## Revenue Splitting

Configure a `PublisherVault` to atomically split payments across publisher / pool / protocol
in a single PTB. Pass `vaultId` to `createPaywall` to enable split mode.

## Full Documentation

See [docs/PUBLISHER.md](../../docs/PUBLISHER.md) or the Tollgate website.

## License

MIT
