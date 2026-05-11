# Tollgate — HTTP 402 Paywall for AI Agents

> **robots.txt was a suggestion. This isn't.**

Tollgate makes AI agent content access **enforceable at the protocol layer**. Publishers drop in two lines of SDK to gate any route and receive USDC micropayments directly in their Solana wallet. AI agents pay automatically, or they don't get in.

---

## Live links

| Resource | URL |
|---|---|
| Landing page | https://tollgate.vercel.app |
| Facilitator API | https://ai-paywall-production-f453.up.railway.app |
| Publisher SDK (npm) | https://www.npmjs.com/package/tollgate-sdk |
| Agent SDK (npm) | https://www.npmjs.com/package/tollgate-agent-sdk |
| Publisher docs | https://tollgate.vercel.app/docs/publisher |
| Agent docs | https://tollgate.vercel.app/docs/agent |

---

## What this solves

AI crawlers (GPTBot, ClaudeBot, PerplexityBot) scrape web content at scale, train on it, and return zero revenue to publishers. `robots.txt` is advisory — it's ignored when economically convenient.

Tollgate attaches a **price tag** to bot access using HTTP 402 Payment Required. The server issues a signed payment challenge; the agent submits a USDC transfer on Solana and retries with a payment header. Content unlocks in ~400ms. USDC lands directly in the publisher's wallet — no platform cut, no intermediary.

---

## How it works

```
AI Agent                    Publisher Server              Solana
   │                              │                          │
   │── GET /article ─────────────▶│                          │
   │                              │  (bot fingerprint)       │
   │◀── HTTP 402 ─────────────────│                          │
   │    {                         │                          │
   │      payTo: "<wallet ATA>",  │                          │
   │      amount: 1000 µUSDC,     │                          │
   │      challenge: "tok_9fK2"   │                          │
   │    }                         │                          │
   │                              │                          │
   │── USDC transfer ────────────────────────────────────────▶│
   │                              │                          │
   │── GET /article ─────────────▶│                          │
   │   X-PAYMENT: <signed_tx>     │── verify tx ────────────▶│
   │   x-paywall-challenge: ...   │◀── confirmed ────────────│
   │                              │                          │
   │◀── HTTP 200 + content ───────│                          │
```

1. AI bot hits a protected route → server returns HTTP 402 with an x402 payment envelope
2. Agent SDK reads the envelope, submits a USDC SPL transfer on Solana, retries with `X-PAYMENT` and `x-paywall-challenge` headers
3. Facilitator verifies the on-chain transaction via Solana RPC — replays are blocked via Supabase cache
4. Content unlocked. USDC lands in the publisher's wallet. No intermediary.

---

## Try it in 30 seconds

```bash
# 1. Hit the live server as a human — passes through
curl https://ai-paywall-production-f453.up.railway.app/health

# 2. Hit it as an AI bot — gets HTTP 402
curl -A "GPTBot/1.0" https://ai-paywall-production-f453.up.railway.app/articles/test
# → HTTP 402 with x402 payment envelope

# 3. Use the Publisher SDK on your own server (see below)
npm install tollgate-sdk

# 4. Use the Agent SDK to pay programmatically (see below)
npm install tollgate-agent-sdk @solana/web3.js @solana/spl-token @x402-solana/core
```

---

## Publisher SDK — gate your content

```bash
npm install tollgate-sdk
```

```js
import { createPaywall } from "tollgate-sdk";
import { expressMiddleware } from "tollgate-sdk/express";

const paywall = createPaywall({
  walletAddress: process.env.SOLANA_WALLET_ADDRESS, // your wallet — USDC lands here
  network: "mainnet-beta",                          // or "devnet" for testing
  protect: ["/articles/*", "/api/data/*"],          // glob patterns to gate
  basePriceMicroUsdc: 1_000,                        // $0.001 per crawl
});

app.use(expressMiddleware(paywall));

// Paid requests expose payment info on req
app.get("/articles/:slug", (req, res) => {
  res.json({ content: "...", paid: true, sig: req.paywallPayment?.signature });
});
```

Adapters included: **Express · Next.js App Router · Fastify · Cloudflare Workers**

Full reference: [docs/PUBLISHER.md](docs/PUBLISHER.md) · [online docs](https://tollgate.vercel.app/docs/publisher)

---

## Agent SDK — pay paywalls automatically

```bash
npm install tollgate-agent-sdk @solana/web3.js @solana/spl-token @x402-solana/core
```

```js
import { createAgentPaywallClient, fromKeypairFile } from "tollgate-agent-sdk";

const client = createAgentPaywallClient({
  network: "mainnet-beta",
  signer: fromKeypairFile(),         // reads ~/.config/solana/id.json
  maxAmountMicroUsdc: 10_000,        // hard cap: $0.01 per request
  maxTotalMicroUsdc: 1_000_000,      // session budget: $1.00
});

// Drop-in fetch — auto-pays 402s, retries transparently
const res = await client.fetch("https://example.com/articles/ai-trends");
const data = await res.json();

console.log("paid:", res.paywallPayment?.signature);
console.log("total spend:", client.spend(), "µUSDC");
```

Full reference: [docs/AGENT.md](docs/AGENT.md) · [online docs](https://tollgate.vercel.app/docs/agent)

---

## Run locally

### Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) project
- A Solana wallet address (receives payments)
- Optional: a funded devnet wallet for testing

### 1. Clone and install

```bash
git clone https://github.com/your-org/ai-paywall.git
cd ai-paywall
npm install
```

### 2. Set up Supabase

Open the [Supabase SQL editor](https://app.supabase.com) and run the contents of `supabase/schema.sql`. This creates:
- `payments` — payment analytics, keyed by wallet address
- `verified_tx_cache` — replay protection (one Solana tx → one unlock)

### 3. Configure environment

Copy and fill in `.env` at the repo root:

```bash
# Your Solana wallet — USDC payments land here directly
WALLET_ADDRESS=YourSolanaWalletBase58...

# Solana network
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com   # use a paid RPC in production

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# HMAC secrets — generate with: openssl rand -hex 32
PAYWALL_CHALLENGE_SECRET=<32-byte-hex>
PAYWALL_AUTH_SECRET=<32-byte-hex>
PAYWALL_AUTH_DOMAIN=localhost:3000

# Optional: fee payer keypair for auto-creating recipient USDC ATAs
# JSON array from `solana-keygen new` or base58-encoded secret
FACILITATOR_FEE_PAYER_SECRET_KEY=[...]

PORT=3000
```

### 4. Start the facilitator server

```bash
npm start
# Server running at http://localhost:3000
```

### 5. (Optional) Run the landing page locally

```bash
cd landing
npm install
npm run dev
# Open http://localhost:3001
```

---

## Testing

### Smoke tests (curl)

```bash
# Health check
curl http://localhost:3000/health
# → { "status": "ok", "uptime": N }

# Human browser request — passes through with 200
curl http://localhost:3000/articles/test

# AI bot request — blocked with 402
curl -A "GPTBot/1.0" http://localhost:3000/articles/test
# → 402 with x402 envelope containing payTo, amount, challenge

# Multiple known bot UAs
curl -A "ClaudeBot/1.0" http://localhost:3000/articles/test
curl -A "PerplexityBot/1.0" http://localhost:3000/articles/test
```

### End-to-end payment flow

This test performs a real on-chain USDC payment on devnet and verifies the full 402 → pay → 200 flow:

```bash
# Prerequisites: funded devnet wallet at ~/.config/solana/id.json
# Get devnet SOL:  solana airdrop 2 --url devnet
# Get devnet USDC: https://faucet.circle.com (mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)

# Against the local server
npm run test:e2e

# Against the live deployed server
BASE_URL=https://ai-paywall-production-f453.up.railway.app npm run test:e2e

# Against your own consumer service
CONSUMER_URL=http://localhost:4010 node e2e-sdk-flow.js
```

The test:
1. Sends a bot request → asserts `HTTP 402`
2. Reads the x402 envelope (`payTo`, `amount`, `challenge`)
3. Submits a USDC SPL transfer on Solana devnet
4. Retries with `X-PAYMENT` + `x-paywall-challenge` headers → asserts `HTTP 200`

---

## Project structure

```
ai-paywall/
├── packages/
│   ├── ai-paywall-sdk/           # tollgate-sdk (npm)
│   │   └── src/
│   │       ├── index.js              # createPaywall()
│   │       ├── core/
│   │       │   ├── paywall.js        # framework-agnostic orchestrator
│   │       │   ├── botDetector.js    # multi-signal bot scoring
│   │       │   └── client.js         # facilitator API client
│   │       └── adapters/
│   │           ├── express.js
│   │           ├── nextjs.js
│   │           ├── fastify.js
│   │           └── cloudflare.js
│   └── ai-paywall-agent-sdk/     # tollgate-agent-sdk (npm)
│       └── src/
│           ├── index.js              # createAgentPaywallClient()
│           └── core/
│               ├── client.js         # fetch() wrapper + payment loop
│               ├── payment.js        # USDC transfer builder
│               ├── signer.js         # keypair helpers (file, array, base58, custom)
│               ├── guards.js         # safety policy + budget enforcement
│               ├── spendTracker.js   # per-session spend tracking + coalescing
│               └── errors.js         # typed error classes
│
├── server/                       # Facilitator server (deployed on Railway)
│   ├── index.js                  # Express entry point
│   ├── routes/
│   │   ├── v1.js                 # /v1/challenge, /v1/verify, /v1/auth/*, /v1/dashboard
│   │   ├── content.js            # catch-all content route (402 for bots, passthrough for humans)
│   │   ├── dashboard.js          # /dashboard HTML UI
│   │   └── policy.js             # /.well-known/ai-policy.json
│   ├── middleware/
│   │   └── aiDetector.js         # composite bot scoring middleware
│   └── services/
│       ├── verifyPayment.js      # on-chain USDC verification via Solana RPC
│       ├── paymentChallenge.js   # HMAC-signed challenge token issuance
│       ├── walletAuth.js         # Sign-In With Solana session management
│       ├── relevanceScorer.js    # dynamic pricing engine
│       └── verifyPaymentForWallet.js
│
├── client/
│   └── dashboard.html            # Analytics dashboard UI
├── landing/                      # Next.js marketing site (deployed on Vercel)
├── supabase/
│   └── schema.sql                # Postgres schema (run once in Supabase SQL editor)
├── docs/
│   ├── PUBLISHER.md              # Full publisher integration guide
│   └── AGENT.md                  # Full agent SDK guide
└── test/
    ├── e2e.js                    # End-to-end test suite (real devnet payments)
    └── e2e-sdk-flow.js           # SDK-level e2e flow
```

---

## API reference

All SDK-facing endpoints are stateless and unauthenticated.

### SDK endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/v1/challenge` | Issue an x402 payment challenge for a wallet + resource |
| `POST` | `/v1/verify` | Verify an on-chain USDC payment against a challenge |
| `GET` | `/v1/wallet/treasury` | Look up the USDC ATA for a wallet address |

### Dashboard (Sign-In With Solana)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/v1/auth/nonce` | Request a SIWS challenge nonce |
| `POST` | `/v1/auth/verify` | Submit signed nonce, receive 24h session token |
| `GET` | `/v1/dashboard` | Fetch payment analytics for the authenticated wallet |

### Utility

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Health check — `{ status: "ok", uptime: N }` |
| `GET` | `/.well-known/ai-policy.json` | Machine-readable pricing policy |
| `GET` | `/dashboard` | Dashboard HTML UI |

---

## Bot detection

The server uses a multi-signal scoring approach to identify AI crawlers without blocking human visitors:

| Signal | Weight | Examples |
|--------|--------|---------|
| User-Agent pattern | High | `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Googlebot`, `bingbot` |
| Missing browser headers | Medium | No `Accept-Language`, no `Sec-Fetch-*` |
| Datacenter IP CIDR | Medium | AWS, GCP, Azure, Cloudflare CIDR ranges |
| Reverse DNS | Medium | Hostname resolves to known crawler infra |
| `robots.txt` fetch spike | Low | Crawler fingerprint pattern |

Score ≥ threshold → HTTP 402 with x402 envelope. Humans pass through without any latency penalty (scoring is local, no network call).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Facilitator server | Node.js (ES Modules), Express |
| Blockchain | Solana (devnet + mainnet-beta) |
| Token | USDC SPL token |
| Payment protocol | x402 (`@x402-solana/core`) |
| Database | Supabase Postgres |
| Dashboard auth | Sign-In With Solana (stateless HMAC-signed sessions) |
| Landing page | Next.js 14, Tailwind CSS, Framer Motion |
| Deployment | Railway (server) + Vercel (landing) |

---

## Documentation

- [Publisher guide](docs/PUBLISHER.md) — install the SDK, gate content, configure pricing, dashboard auth
- [Agent guide](docs/AGENT.md) — auto-pay 402s, budget limits, LangChain tool, typed errors
- [Online publisher docs](https://tollgate.vercel.app/docs/publisher)
- [Online agent docs](https://tollgate.vercel.app/docs/agent)

---

## License

MIT
