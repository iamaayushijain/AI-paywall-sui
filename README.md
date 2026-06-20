# Tollgate — On-Chain AI Paywall on SUI

> **robots.txt was a suggestion. This isn't.**

Tollgate makes AI agent access to web content **enforceable at the protocol layer** — using Move smart contracts on SUI. Publishers gate any HTTP route with two lines of code. AI agents pay in SUI, get content unlocked, and the revenue flows on-chain — atomically, trustlessly, without any intermediary.

---

## Demo Video

[![Tollgate Demo](https://img.shields.io/badge/Watch%20Demo-YouTube-red?style=for-the-badge&logo=youtube)](https://youtu.be/YOUR_VIDEO_ID_HERE)

> _Replace the link above with your actual YouTube video URL_

---

## Live Links

| Resource | URL |
|---|---|
| Frontend | https://sui.tollgate.xyz |
| SUI Explorer — Package | https://suiscan.xyz/testnet/object/0x39ec449717b8df2737423620ed3a893899cc35d08a974505f0bafee2bf190168 |

---

## The Problem

AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Bytespider) scrape web content at scale, train on it, and return zero revenue to the publishers who created it. `robots.txt` is advisory — it is routinely ignored when economically convenient.

Tollgate attaches a **price tag** to bot access using HTTP 402 Payment Required. The paywall is enforced by a Move smart contract on SUI — not a database, not a trusted server, not a signature check that can be faked. The challenge object is consumed on-chain, making replay attacks structurally impossible.

---

## How It Works

```
AI Agent                  Publisher Server              SUI Blockchain
   │                            │                              │
   │── GET /article ───────────▶│                              │
   │   User-Agent: GPTBot       │ (bot detected)               │
   │                            │── create_challenge() ───────▶│
   │                            │◀── PaywallChallenge obj ─────│
   │◀── HTTP 402 ───────────────│                              │
   │    {                       │                              │
   │      challengeObjectId,    │                              │
   │      priceMist: 1_000_000, │                              │
   │      packageId,            │                              │
   │      target: pay_and_unlock│                              │
   │    }                       │                              │
   │                            │                              │
   │── PTB: pay_and_unlock() ──────────────────────────────────▶│
   │   (challenge, coin, clock) │            challenge deleted  │
   │                            │            PaymentVerified    │
   │── GET /article ───────────▶│            event emitted     │
   │   X-SUI-PAYMENT-TX: <dig>  │── verify tx on-chain ───────▶│
   │   X-SUI-CHALLENGE-ID: <id> │◀── PaymentVerified event ────│
   │                            │                              │
   │◀── HTTP 200 + content ─────│                              │
```

1. AI bot hits a protected route → server calls `create_challenge()` on SUI, returns a 402 with the shared object ID
2. Agent builds a Programmable Transaction Block (PTB): `pay_and_unlock(challenge, coin, clock)`
3. The challenge object is **consumed** on-chain — this is the replay protection. A second attempt with the same object ID fails because the object no longer exists
4. Server reads the `PaymentVerified` event from the transaction to confirm payment
5. Content unlocked. SUI lands directly in the publisher's wallet

---

## Smart Contracts

**Package ID (Testnet):**
```
0x39ec449717b8df2737423620ed3a893899cc35d08a974505f0bafee2bf190168
```

**Network:** SUI Testnet

### `tollgate::paywall`

The core paywall module. Handles single-recipient payments.

| Function | Description |
|---|---|
| `create_challenge(resource, publisher, price_mist, expires_at_ms)` | Server calls this to create a shared `PaywallChallenge` object |
| `pay_and_unlock(challenge, coin, clock)` | Agent calls this in a PTB to pay and consume the challenge. Returns overpayment to sender |

Emits: `PaymentVerified { challenge_id, payer, publisher, resource, amount_mist }`

### `tollgate::vault`

Revenue-splitting vault. A publisher deploys one `PublisherVault` that encodes how incoming payments are routed across publisher / content pool / protocol — all in basis points. Stats accumulate on-chain without an indexer.

| Function | Description |
|---|---|
| `create_vault(publisher_bps, pool_address, pool_bps, protocol_address, protocol_bps)` | Publisher calls once to register their routing config |
| `pay_and_unlock_split(challenge, vault, coin, clock)` | Agent pays via split routing. Atomically transfers each portion in one PTB |

Emits: `SplitPaymentReceived { vault_id, challenge_id, payer, publisher, total_mist, publisher_mist, pool_mist, protocol_mist }`

---

## Bot Detection

The server uses multi-signal scoring to identify AI crawlers without adding any latency for human visitors. Scoring is entirely local — no network call.

| Signal | Weight | Examples |
|---|---|---|
| User-Agent pattern | High | GPTBot, ClaudeBot, PerplexityBot, Bytespider, ChatGPT-User |
| Missing browser headers | Medium | No `Accept-Language`, no `Sec-Fetch-*` headers |
| Datacenter IP CIDR | Medium | AWS, GCP, Azure, Cloudflare ranges |
| Reverse DNS | Medium | Hostname resolves to known crawler infrastructure |

Score ≥ threshold → HTTP 402. Humans pass through with zero overhead.

---

## Quick Start

### Publisher SDK — gate your content

```bash
npm install tollgate-sdk
```

```js
import { createPaywall } from "tollgate-sdk";
import { expressMiddleware } from "tollgate-sdk/express";

const paywall = createPaywall({
  walletAddress: process.env.SUI_PUBLISHER_ADDRESS,
  network: "testnet",
  protect: ["/articles/*", "/api/data/*"],
  basePriceMist: 1_000_000,  // 0.001 SUI per crawl
});

app.use(expressMiddleware(paywall));
```

Adapters: **Express · Next.js App Router · Fastify · Cloudflare Workers**

### Agent SDK — pay paywalls automatically

```bash
npm install tollgate-agent-sdk
```

```js
import { createAgentPaywallClient } from "tollgate-agent-sdk";

const client = createAgentPaywallClient({
  network: "testnet",
  secretKey: process.env.SUI_AGENT_SECRET_KEY,
  maxPriceMist: 5_000_000,   // hard cap per request
});

// Drop-in fetch — auto-pays 402s, retries transparently
const res = await client.fetch("https://example.com/articles/ai-trends", {
  headers: { "User-Agent": "GPTBot" },
});
```

---

## Run Locally

### Prerequisites

- Node.js ≥ 18
- SUI CLI (`brew install sui`)
- A SUI testnet wallet with SUI for gas

### 1. Clone and install

```bash
git clone https://github.com/iamaayushijain/ai-paywall.git
cd ai-paywall
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in these required variables:

```env
SUI_SERVER_SECRET_KEY=suiprivkey1...   # bech32 private key (run: sui keytool export --key-identity <alias>)
SUI_PACKAGE_ID=0x39ec449717b8df2737423620ed3a893899cc35d08a974505f0bafee2bf190168
SUI_NETWORK=testnet
PORT=3001

# Optional — who receives payments (defaults to server address)
SUI_PUBLISHER_ADDRESS=0x...

# Optional — enable split payments
SUI_VAULT_ID=0x...
```

### 3. Start the server

```bash
npm start
# ⛓️  Tollgate SUI Server running on http://localhost:3001
```

### 4. Test the paywall flow

```bash
# Human request — passes through
curl http://localhost:3001/articles/test

# Bot request — gets 402 with on-chain challenge
curl -A "GPTBot/1.0" http://localhost:3001/articles/test

# End-to-end SUI payment test
npm run test:sui
```

### 5. Run the landing page locally

```bash
cd landing
npm install
npm run dev
# http://localhost:3000
```

---

## API Reference

Base URL: `http://localhost:3001` (or your deployed server URL)

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/sui/v1/info` | Server config — address, package ID, network |
| `POST` | `/sui/v1/challenge` | Create an on-chain `PaywallChallenge` object |
| `POST` | `/sui/v1/verify` | Verify a `pay_and_unlock` transaction |
| `POST` | `/sui/v1/vault/create` | Create a `PublisherVault` with split config |
| `GET` | `/sui/v1/vault/:id` | Read vault stats from chain |
| `POST` | `/sui/v1/vault/verify` | Verify a `pay_and_unlock_split` transaction |

### POST `/sui/v1/challenge`

```json
{
  "resource": "/articles/test",
  "publisherAddress": "0x...",
  "priceMist": 1000000
}
```

### POST `/sui/v1/verify`

```json
{
  "txDigest": "AbCd...",
  "challengeObjectId": "0x...",
  "publisherAddress": "0x...",
  "priceMist": 1000000
}
```

---

## Payment Modes

### Simple mode (default)

Agent calls `tollgate::paywall::pay_and_unlock`. Full payment goes directly to the publisher address.

```
PTB: splitCoins(gas, [priceMist]) → pay_and_unlock(challenge, coin, clock)
```

### Split mode (vault)

Agent calls `tollgate::vault::pay_and_unlock_split`. Payment is atomically split across publisher / pool / protocol in one transaction.

```
PTB: splitCoins(gas, [priceMist]) → pay_and_unlock_split(challenge, vault, coin, clock)
```

Example split: Publisher 80% · Content Pool 15% · Protocol 5%

---

## Project Structure

```
tollgate-sui/
├── move/tollgate/
│   ├── sources/
│   │   ├── paywall.move          # Core challenge/unlock logic
│   │   └── vault.move            # Revenue-splitting vault
│   └── Move.toml
│
├── server/
│   ├── sui-index.js              # Express entry point
│   ├── routes/
│   │   ├── suiApi.js             # /sui/v1/* endpoints
│   │   └── suiContent.js         # Catch-all content route (402 / verify / unlock)
│   ├── services/
│   │   └── suiPaywall.js         # SUI RPC client, transaction building, event parsing
│   └── middleware/
│       └── aiDetector.js         # Multi-signal bot scoring
│
├── packages/
│   ├── ai-paywall-sdk/           # tollgate-sdk (publisher)
│   └── ai-paywall-agent-sdk/     # tollgate-agent-sdk (agent)
│
├── landing/                      # Next.js 14 marketing site
├── scripts/
│   ├── export-sui-key.js         # Export server keypair
│   └── pay-challenge.js          # Manual payment testing
└── test/
    └── sui-e2e.js                # End-to-end SUI payment test
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Move on SUI |
| Payment token | SUI (MIST) |
| Server | Node.js (ES Modules), Express |
| Bot detection | Multi-signal UA + IP + DNS scoring |
| Frontend | Next.js 14, Tailwind CSS, Framer Motion |
| Deployment | Vercel (frontend) |
| SUI SDK | `@mysten/sui` |

---

## License

MIT
