# AI Paywall — HTTP 402 + Solana

A minimal server that charges AI agents for content access using **HTTP 402** and **Solana** payments on devnet.

## How It Works

1. A request hits `/page`
2. The middleware checks if the visitor is an AI bot (via User-Agent)
3. **Human** → content served free
4. **AI bot, no payment** → returns `HTTP 402` with a Solana wallet address and price
5. **AI bot, with `x-payment-tx` header** → verifies the transaction on-chain
6. **Valid tx** → content unlocked · **Invalid tx** → `HTTP 403`

## Quick Start

```bash
# Install dependencies
npm install

# (Optional) Edit .env with your own Solana devnet wallet
# WALLET_ADDRESS=YourDevnetWallet

# Start the server
npm start
```

Server runs at `http://localhost:3000`.

## Endpoints

| Route | Description |
|---|---|
| `GET /page` | Content endpoint (402 for bots) |
| `GET /dashboard` | View recorded payments (JSON) |
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

### AI request with transaction signature

```bash
curl -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.0)" \
     -H "x-payment-tx: YOUR_TX_SIGNATURE_HERE" \
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
