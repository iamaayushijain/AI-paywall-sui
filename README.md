# AI Paywall — HTTP 402 + Solana

A minimal server that charges AI agents for content access using **HTTP 402** and **Solana** payments on devnet.

## How It Works

1. A request hits `/page`
2. The middleware checks if the visitor is an AI bot (via User-Agent)
3. **Human** → content served free
4. **AI bot, no payment** → returns `HTTP 402` with a Solana wallet address and price
5. **AI bot, with `x-payment` + `x-paywall-challenge` headers** → verifies transaction + challenge binding
6. **Valid tx** → content unlocked · **Invalid tx** → `HTTP 403`

## Quick Start

```bash
# Install dependencies
npm install

# (Optional) Edit .env with your own Solana devnet wallet
# WALLET_ADDRESS=YourDevnetWallet
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Start the server
npm start
```

Server runs at `http://localhost:3000`.

## Supabase Setup (Shared Database)

This project stores payment records and tx replay cache in Supabase Postgres.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set these env vars in `.env`:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

If these variables are missing, the server will fail fast at boot.

## Endpoints

| Route | Description |
|---|---|
| `GET /page` | Content endpoint (402 for bots) |
| `GET /dashboard` | Owner dashboard UI |
| `GET /dashboard/data` | Dashboard data (JSON) |
| `GET /.well-known/ai-policy.json` | Machine-readable pricing policy |
| `GET /health` | Health check |
| `GET /` | Dashboard UI |

## Example curl Requests

### Normal (human) request

```bash
curl http://localhost:3000/page
```

### AI request — triggers 402

```bash
curl -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.0)" \
     http://localhost:3000/page
```

### AI request with payment + challenge token

```bash
curl -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.0)" \
     -H "x-payment: YOUR_X402_PAYMENT_HERE" \
     -H "x-paywall-challenge: TOKEN_FROM_402_RESPONSE" \
     http://localhost:3000/page
```

## Run Test Suite

```bash
# Start server first, then in another terminal:
npm run test:ai
```

## Tech Stack

- **Node.js** (ES Modules)
- **Express.js**
- **@solana/web3.js** (devnet)
- In-memory storage (no database)

## Project Structure

```
ai-paywall/
├── server/
│   ├── index.js              # Express entry point
│   ├── routes/
│   │   ├── page.js           # /page — content + 402 logic
│   │   ├── policy.js         # /.well-known/ai-policy.json
│   │   └── dashboard.js      # /dashboard — payment history
│   ├── middleware/
│   │   └── aiDetector.js     # User-Agent bot detection
│   ├── services/
│   │   ├── solana.js         # Solana connection
│   │   └── verifyPayment.js  # On-chain tx verification
│   └── data/
│       └── payments.js       # In-memory payment store
├── client/
│   └── index.html            # Dashboard UI
├── test/
│   └── simulate.js           # Test helper script
├── .env
├── package.json
└── README.md
```

## License

MIT
