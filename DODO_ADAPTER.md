# Dodo Payments Adapter

Alternative settlement layer for Tollgate using [Dodo Payments](https://dodopayments.com) instead of Solana USDC. The x402 HTTP challenge protocol is unchanged — only the payment rail differs.

## Architecture

```
AI Agent              Publisher Server           Facilitator            Dodo
   │                        │                        │                    │
   │── GET /article ────────▶│                        │                    │
   │                        │ (bot detected)          │                    │
   │                        │── POST /v1/dodo/session ▶│                   │
   │                        │                        │── createCheckout ──▶│
   │                        │                        │◀── { url, sid } ───│
   │◀─ HTTP 402 ────────────│                        │                    │
   │   x-payment-required:  │                        │                    │
   │   { payment_url, sid } │                        │                    │
   │                        │                        │                    │
   │── GET payment_url ─────────────────────────────────────────────────▶│
   │   (Dodo hosted checkout)                        │                    │
   │                        │                        │◀── webhook ────────│
   │                        │                        │  payment.succeeded  │
   │                        │                        │ markSessionPaid()   │
   │                        │                        │                    │
   │── GET /v1/dodo/session/{sid}/token ────────────▶│                    │
   │◀── { token: <jwt> } ──────────────────────────│                    │
   │                        │                        │                    │
   │── GET /article ────────▶│                        │                    │
   │   x-tollgate-token: jwt│── POST /v1/dodo/token/verify ─────────────▶│
   │                        │◀── { valid: true } ────│                    │
   │◀─ HTTP 200 + content ──│                        │                    │
```

## Files

```
server/adapters/dodo/
├── DodoPaymentAdapter.js     Core adapter class + JWT + webhook sig verification
├── webhookRoute.js           POST /webhook/dodo — receives Dodo events
├── apiRoute.js               POST /v1/dodo/session, GET /v1/dodo/session/:id/*
├── DodoPayoutsService.js     Read-only Dodo payouts API + per-publisher accounting
└── verifyContentToken.js     Express middleware — verifies x-tollgate-token

server/data/
└── dodoSessions.js           Supabase queries for dodo_sessions + dodo_usage_events

supabase/
└── dodo_schema.sql           Run after schema.sql — creates dodo_sessions + dodo_usage_events

packages/ai-paywall-sdk/src/adapters/
└── dodo.js                   Publisher SDK — dodoMiddleware() for Express
```

## Quick Start

### Publisher

```js
import { paywallMiddleware } from "tollgate-sdk/express";

app.use(paywallMiddleware({
  adapter:     "dodo",
  publisherId: "my-site",   // any opaque string
  price:       0.01,         // USD per access
  protect:     ["/articles/*"],
  apiUrl:      "https://ai-paywall-production-f453.up.railway.app",
}));

app.get("/articles/:slug", (req, res) => {
  // req.tollgate = { sessionId, publisherId, contentId, amountUsd, adapter: "dodo" }
  res.json({ content: "..." });
});
```

Or with the Dodo-specific import:

```js
import { dodoMiddleware } from "tollgate-sdk/dodo";
app.use(dodoMiddleware({ publisherId: "my-site", price: 0.01 }));
```

### Agent (manual flow)

```js
// 1. Hit protected route
const r1 = await fetch("https://publisher.com/articles/ai");
if (r1.status === 402) {
  const { payment_url, session_id } = await r1.json();

  // 2. Open Dodo checkout (or use Dodo's MCP server)
  console.log("Pay here:", payment_url);

  // 3. Poll for confirmation
  let status = "pending";
  while (status === "pending") {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(`https://facilitator/v1/dodo/session/${session_id}/status`);
    ({ status } = await poll.json());
  }

  // 4. Get content token
  const { token } = await fetch(
    `https://facilitator/v1/dodo/session/${session_id}/token`
  ).then(r => r.json());

  // 5. Retry with token
  const r2 = await fetch("https://publisher.com/articles/ai", {
    headers: { "x-tollgate-token": token },
  });
  const data = await r2.json();
}
```

## Environment Variables

Add to `.env`:

```bash
# Dodo Payments API key (from Dodo dashboard)
DODO_PAYMENTS_API_KEY=

# Webhook signing secret (from Dodo dashboard → Webhooks)
DODO_PAYMENTS_WEBHOOK_KEY=

# test_mode (default) or live_mode
DODO_ENVIRONMENT=test_mode

# Product ID from your Dodo dashboard — represents a single "content access" unit
DODO_PRODUCT_ID=

# Secret for signing content JWTs — generate with: openssl rand -hex 32
JWT_SECRET=

# Public URL of the facilitator (used in webhook return_url and cancel_url)
FACILITATOR_URL=https://ai-paywall-production-f453.up.railway.app
```

## Dodo Dashboard Setup

1. **Create a product** — represents one "AI content access". Set price to your default (e.g. $0.01). Note the Product ID → set as `DODO_PRODUCT_ID`.
2. **Register webhook endpoint** — `https://your-facilitator.railway.app/webhook/dodo`. Select event: `payment.succeeded`. Copy the signing secret → set as `DODO_PAYMENTS_WEBHOOK_KEY`.
3. **Copy API key** → set as `DODO_PAYMENTS_API_KEY`.

## Supabase Setup

After running `supabase/schema.sql`, also run `supabase/dodo_schema.sql`:

```sql
-- In Supabase SQL editor
\i supabase/dodo_schema.sql
```

This creates:
- `dodo_sessions` — one row per payment session (pending → paid lifecycle)
- `dodo_usage_events` — immutable billing log, keyed by `dodo_payment_id` (unique, prevents webhook replay double-billing)

## Webhook Security

Webhooks are verified using HMAC-SHA256 per the [Standard Webhooks](https://www.standardwebhooks.com/) spec:

1. `HMAC-SHA256(secret, "${webhook-id}.${webhook-timestamp}.${body}")`
2. Compare with `webhook-signature` header (`v1,<base64>` format)
3. Reject timestamps older than 5 minutes (replay protection)
4. Respond 200 immediately, process async (`setImmediate`) so Dodo doesn't retry on latency

## Payouts

Dodo does not expose a "create payout" API — payouts are managed automatically by Dodo on a schedule set in the dashboard. `DodoPayoutsService` provides:

- `listPayouts()` — recent payout history from Dodo's API
- `getPublisherBalance(publisherId)` — revenue total from our `dodo_usage_events` table
- `getPublisherEvents(publisherId)` — per-access breakdown

## Isolation guarantee

The Solana path (`server/routes/v1.js`, `server/services/verifyPayment.js`, `packages/ai-paywall-sdk/src/core/paywall.js`) is **completely untouched**. The only modifications to existing files are:

| File | Change |
|------|--------|
| `server/index.js` | +3 lines: import and mount `/webhook/dodo` + `/v1/dodo` |
| `packages/ai-paywall-sdk/src/adapters/express.js` | Added `paywallMiddleware()` export above existing `expressMiddleware()` |
| `packages/ai-paywall-sdk/package.json` | Added `"./dodo"` export entry |
| `package.json` | Added `dodopayments` dependency |

## Running tests

```bash
node --test test/dodo-webhook.test.js
node --test test/dodo-token.test.js
```
