# @ai-paywall/agent-sdk

**Drop-in 402-paywall client for AI agents.** Gives any agent — scrapers,
LangChain tools, OpenAI function-callers, custom autonomous workers — the
ability to pay HTTP 402 paywalls automatically and safely.

> If you publish content, use `@ai-paywall/sdk` to **gate** it.
> If you build agents, use `@ai-paywall/agent-sdk` to **pay** for it.

## What it does

Replaces the entire ~165-line manual flow in `e2e-sdk-flow.js` with one call:

```js
const res = await client.fetch("https://example.com/articles/test");
```

When the server returns `200`, this is a passthrough. When the server
returns `402`, the SDK:

1. parses the x402 envelope and challenge token
2. **validates** it against your safety policy (network, mint, payTo,
   max amount per request, lifetime budget cap)
3. builds, signs, and submits a USDC SPL transfer on Solana
4. mints the matching `X-PAYMENT` header
5. retries the original request with `X-PAYMENT` and `x-paywall-challenge`
6. returns the unlocked `Response` with payment metadata attached

## Install

```bash
npm install @ai-paywall/agent-sdk @solana/web3.js @solana/spl-token @x402-solana/core
```

> The Solana + x402 packages are peer dependencies so your agent project
> stays in control of versions.

## Quick start

```js
import {
  createAgentPaywallClient,
  fromKeypairFile,
} from "@ai-paywall/agent-sdk";

const client = createAgentPaywallClient({
  network: "devnet",
  signer: fromKeypairFile(),       // ~/.config/solana/id.json
  maxAmountMicroUsdc: 10_000,      // never pay > $0.01 per request
  maxTotalMicroUsdc: 1_000_000,    // never spend > $1.00 in this process
  userAgent: "MyAgent/1.0",
});

const res = await client.fetch("http://localhost:4010/articles/test");
const data = await res.json();

console.log("paid:", res.paywallPayment?.signature);
console.log("spend:", client.spend());
```

That's the entire integration. Three lines after config.

## Configuration

| Option                    | Required | Description                                                                         |
| ------------------------- | :------: | ----------------------------------------------------------------------------------- |
| `network`                 |    -     | `"devnet"` (default), `"mainnet-beta"`, or `"testnet"`.                             |
| `signer`                  |    ✓     | Keypair, signer object, or one of the helpers below.                                |
| `rpcUrl`                  |    -     | Override the Solana RPC endpoint.                                                   |
| `usdcMint`                |    -     | Override USDC mint (rarely needed).                                                 |
| `maxAmountMicroUsdc`      |    -     | **Recommended.** Hard cap on a single payment. Refuses larger 402s.                 |
| `maxTotalMicroUsdc`       |    -     | **Recommended.** Lifetime budget for this client; throws when exceeded.             |
| `allowedMints`            |    -     | Allowlist of acceptable asset mints.                                                |
| `allowedRecipients`       |    -     | Allowlist of acceptable `payTo` ATAs.                                               |
| `autoPay`                 |    -     | Default `true`. If `false`, 402s pass through unchanged.                            |
| `userAgent`               |    -     | User-Agent header on all requests.                                                  |
| `confirmCommitment`       |    -     | Solana commitment level (default `"confirmed"`).                                    |
| `onChallenge(info)`       |    -     | Approval hook. Return `false` to refuse before paying.                              |
| `onPayment(info)`         |    -     | Fired after each successful payment (logging, telemetry, persistence).              |
| `fetchImpl`               |    -     | Custom `fetch` (e.g. for Node 16 or sandboxes).                                     |

## Signers

Pick whichever fits your runtime:

```js
import {
  fromKeypair,             // pass a @solana/web3.js Keypair
  fromKeypairFile,         // read ~/.config/solana/id.json (or any path)
  fromSecretKeyArray,      // Uint8Array / number[] (Solana CLI JSON format)
  fromSecretKeyBase58,     // base58 64-byte secret
} from "@ai-paywall/agent-sdk";
```

For HSM, KMS, browser wallets, or remote signing services, build your own:

```js
const signer = {
  publicKey,                          // PublicKey
  async signTransaction(tx) {         // sign in place and return
    await myKms.sign(tx);
    return tx;
  },
};
```

## Safety guards

The SDK refuses to sign anything that violates operator policy. Each
violation throws a typed error from `@ai-paywall/agent-sdk/errors`:

| Error                          | Code                       | When                                                |
| ------------------------------ | -------------------------- | --------------------------------------------------- |
| `PaymentRefusedError`          | `PAYMENT_REFUSED`          | Network/mint/recipient/amount violates policy.      |
| `PaymentBudgetExceededError`   | `BUDGET_EXCEEDED`          | Lifetime cap would be exceeded.                     |
| `UnsupportedChallengeError`    | `UNSUPPORTED_CHALLENGE`    | 402 is malformed or uses an unsupported scheme.     |
| `OnChainError`                 | `ON_CHAIN_ERROR`           | RPC, balance, or confirmation failure.              |
| `VerificationRejectedError`    | `VERIFICATION_REJECTED`    | Server still rejected the request after payment.   |

```js
import { PaymentRefusedError } from "@ai-paywall/agent-sdk";

try {
  await client.fetch(url);
} catch (err) {
  if (err instanceof PaymentRefusedError) {
    // operator policy refused — do not retry
  }
  throw err;
}
```

## Using with LLM agent frameworks

### LangChain

```js
import { paywallFetchTool } from "@ai-paywall/agent-sdk/langchain";

const tool = paywallFetchTool(client, {
  allowHost: (host) => host.endsWith("example.com"),
});

const agent = createOpenAIToolsAgent({ llm, tools: [tool], prompt });
```

### OpenAI tool-calling

The shape returned by `paywallFetchTool` (`{ name, description, schema, invoke }`)
is intentionally framework-neutral. Map `schema` → `parameters` and call
`tool.invoke(args)` from your tool router.

### Anything else

Skip the helper. `client.fetch` is `fetch`-compatible — pass it as the HTTP
function to whatever HTTP/agent layer you already use.

## Concurrency & idempotency

Concurrent requests for the same URL+nonce coalesce automatically. If your
agent fans out 10 parallel `client.fetch(url)` calls and all 10 get the same
`402`, only **one** payment is sent and all 10 callers receive the unlocked
response.

## How it maps to the e2e flow

| Step in `e2e-sdk-flow.js`            | Equivalent in agent-sdk             |
| ------------------------------------ | ----------------------------------- |
| `ensurePayerUsdc()`                  | `assertPayerCanCover` (automatic)   |
| `buildAndSendPaymentHeader()`        | `buildAndSubmitPayment` (automatic) |
| Manually retry with `X-PAYMENT`      | Automatic on every `client.fetch`   |
| Manually echo `x-paywall-challenge`  | Automatic                           |
| Validate amount/mint/network         | Configurable safety guards          |

## License

MIT
