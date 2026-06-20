import Link from "next/link";
import { ArrowRight, Server } from "lucide-react";
import { DocLayout } from "@/components/docs/doc-layout";
import {
  DocSection,
  DocSubSection,
  DocP,
  DocCode,
  DocTable,
  DocBadge,
  DocCallout,
} from "@/components/docs/doc-components";

const SECTIONS = [
  { id: "overview",      label: "Overview" },
  { id: "prerequisites", label: "Prerequisites" },
  { id: "install",       label: "Installation" },
  { id: "quickstart",    label: "Quick Start" },
  { id: "vault",         label: "  Revenue Splitting (Vault)" },
  { id: "config",        label: "Configuration" },
  { id: "bot-detection", label: "Bot Detection" },
  { id: "payment",       label: "Payment Object" },
  { id: "env",           label: "Environment Variables" },
];

export const metadata = {
  title: "Publisher SDK — Tollgate Docs",
  description: "Drop-in HTTP 402 paywall on SUI. Gate content with Express middleware — SUI micropayments arrive on-chain.",
};

export default function PublisherDocsPage() {
  return (
    <DocLayout sdk="publisher" sections={SECTIONS}>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Server className="w-4 h-4 text-accent" />
          </div>
          <span className="section-label">Publisher SDK</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          ai-paywall-sdk-sui
        </h1>
        <p className="mt-3 text-inkMuted max-w-2xl">
          Drop-in AI bot paywall on SUI. Provide your deployed Move package ID and server keypair —
          SUI micropayments land in your on-chain account directly. No API key, no signup, no custodian.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/docs/agent"
            className="inline-flex items-center gap-1.5 text-sm text-inkMuted hover:text-ink transition-colors"
          >
            Looking for the Agent SDK? <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="space-y-0">

        {/* Overview */}
        <DocSection id="overview" title="Overview">
          <DocP>
            Tollgate intercepts HTTP requests at the middleware layer. When it detects an AI bot,
            it creates a <DocBadge>PaywallChallenge</DocBadge> shared object on SUI and returns
            HTTP 402 with the object ID, price in MIST, and the Move call target. Human visitors
            pass through with zero overhead.
          </DocP>
          <DocP>
            On retry with valid <DocBadge>X-SUI-PAYMENT-TX</DocBadge> and{" "}
            <DocBadge>X-SUI-CHALLENGE-ID</DocBadge> headers, the SDK verifies the{" "}
            <DocBadge>PaymentVerified</DocBadge> event on-chain and unlocks content. Replay
            protection is intrinsic — consuming the challenge object in{" "}
            <DocBadge>pay_and_unlock</DocBadge> atomically deletes it.
          </DocP>
          <DocCallout>
            <strong className="text-accent">No Supabase. No database.</strong> The Move contract
            IS the replay protection. A second attempt with the same challenge ID fails because
            the object no longer exists on-chain.
          </DocCallout>
        </DocSection>

        {/* Prerequisites */}
        <DocSection id="prerequisites" title="Prerequisites">
          <DocP>Before using the publisher SDK, you need:</DocP>
          <ol className="list-decimal list-inside text-sm text-inkMuted space-y-1.5 mb-4 pl-1">
            <li>SUI CLI installed and a funded testnet address</li>
            <li>The Tollgate Move package deployed (or use the shared testnet deployment)</li>
            <li>The server keypair private key (the address that creates challenges)</li>
          </ol>
          <DocSubSection title="Deploy the Move contract">
            <DocCode lang="bash">{`# Clone the Tollgate repo and deploy
cd move/tollgate
sui client publish --skip-dependency-verification

# Note the Package Object ID from the output.
# Set SUI_PACKAGE_ID in your .env.`}</DocCode>
          </DocSubSection>
          <DocSubSection title="Export your server key">
            <DocCode lang="bash">{`# Get the bech32 private key for your active SUI address:
sui keytool export --key-identity <your-address>

# Or use the included helper script:
node scripts/export-sui-key.js

# Output: suiprivkey1qr9vrgz...
# Set as SUI_SERVER_SECRET_KEY in your .env`}</DocCode>
          </DocSubSection>
          <DocSubSection title="Fund the server address">
            <DocCode lang="bash">{`# Testnet faucet (or visit https://faucet.sui.io)
sui client faucet

# Check balance
sui client balance`}</DocCode>
          </DocSubSection>
        </DocSection>

        {/* Install */}
        <DocSection id="install" title="Installation">
          <DocCode lang="bash">{`npm install ai-paywall-sdk-sui @mysten/sui`}</DocCode>
          <DocP>
            <DocBadge>@mysten/sui</DocBadge> is a peer dependency — your project controls the version.
          </DocP>
        </DocSection>

        {/* Quick Start */}
        <DocSection id="quickstart" title="Quick Start">
          <DocSubSection title="Express">
            <DocCode lang="js">{`import express from "express";
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

app.listen(3000);`}</DocCode>
          </DocSubSection>

          <DocSubSection id="vault" title="Revenue Splitting with PublisherVault">
            <DocP>
              Enable a <DocBadge>PublisherVault</DocBadge> to automatically split payments across
              publisher, content pool, and protocol in one atomic PTB. Create the vault once via the
              server API, then configure the vault ID.
            </DocP>
            <DocCode lang="bash">{`# Create a vault (80% publisher / 15% pool / 5% protocol)
curl -X POST http://localhost:3001/sui/v1/vault/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "publisherBps": 8000,
    "poolAddress": "0xa4f8...",
    "poolBps": 1500,
    "protocolAddress": "0x24ae...",
    "protocolBps": 500
  }'

# Response: { "vaultObjectId": "0x...", "txDigest": "..." }
# Set SUI_VAULT_ID=<vaultObjectId> in your .env and restart.`}</DocCode>
            <DocCode lang="js">{`// Pass vaultId to createPaywall to enable split payments.
// Agents will automatically call pay_and_unlock_split instead of pay_and_unlock.
const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,
  serverKey: process.env.SUI_SERVER_SECRET_KEY,
  network: "testnet",
  priceMist: 1_000_000,
  vaultId: process.env.SUI_VAULT_ID, // enable split mode
});`}</DocCode>
            <DocCallout>
              The vault stores <DocBadge>total_received_mist</DocBadge> and{" "}
              <DocBadge>payment_count</DocBadge> on-chain. Read live stats at{" "}
              <DocBadge>GET /sui/v1/vault/:id</DocBadge> — no indexer needed.
            </DocCallout>
          </DocSubSection>
        </DocSection>

        {/* Config */}
        <DocSection id="config" title="Configuration">
          <DocP>Pass these options to <DocBadge>createPaywall({"{ ... }"})</DocBadge>.</DocP>
          <DocTable
            headers={["Option", "Default", "Description"]}
            rows={[
              [<DocBadge key="pkg">packageId</DocBadge>, <span key="r" className="text-danger text-xs">required</span>, "Deployed Tollgate Move package ID (0x...)."],
              [<DocBadge key="sk">serverKey</DocBadge>, <span key="r2" className="text-danger text-xs">required</span>, "SUI private key: bech32 (suiprivkey1...) or base64 keystore format."],
              [<DocBadge key="n">network</DocBadge>, <DocBadge key="nd" color="default">"testnet"</DocBadge>, '"testnet" or "mainnet".'],
              [<DocBadge key="r">rpcUrl</DocBadge>, "public RPC", "Override SUI RPC endpoint."],
              [<DocBadge key="p">protect</DocBadge>, <DocBadge key="pd" color="default">["/*"]</DocBadge>, 'Path globs to gate, e.g. ["/articles/*"]. Empty array = protect all.'],
              [<DocBadge key="pm">priceMist</DocBadge>, <DocBadge key="pmd" color="default">1000000</DocBadge>, "Price per crawl in MIST. 1 SUI = 1,000,000,000 MIST."],
              [<DocBadge key="v">vaultId</DocBadge>, "—", "PublisherVault object ID. Enables split payments if set."],
            ]}
          />

          <DocSubSection title="Path matching">
            <DocP>
              The <DocBadge>protect</DocBadge> option accepts strings with <DocBadge>*</DocBadge> wildcards.
            </DocP>
            <DocCode lang="js">{`protect: ["/*"]                  // all routes
protect: ["/articles/*"]        // prefix match
protect: ["/blog/*", "/docs/*"] // multiple prefixes`}</DocCode>
          </DocSubSection>
        </DocSection>

        {/* Bot Detection */}
        <DocSection id="bot-detection" title="Bot Detection">
          <DocP>
            Detection runs entirely in-process — no network call, zero overhead for human visitors.
            Requests are classified as bots by matching the <DocBadge>User-Agent</DocBadge> header
            against a curated pattern list.
          </DocP>
          <DocTable
            headers={["User-Agent patterns detected"]}
            rows={[
              ["GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai"],
              ["PerplexityBot, CCBot, Googlebot, bingbot, Applebot"],
              ["Bytespider, DiffbotCrawler, FacebookBot, LinkedInBot"],
              ["python-requests, python-httpx, Go-http-client"],
              ["Scrapy, curl, wget, axios, node-fetch, undici"],
            ]}
          />
        </DocSection>

        {/* Payment object */}
        <DocSection id="payment" title="Payment Object">
          <DocP>
            After a verified payment, <DocBadge>req.suiPayment</DocBadge> is set on the Express
            request object.
          </DocP>
          <DocCode lang="js">{`// req.suiPayment shape (simple mode)
{
  verified: true,
  payer:      "0x24ae...",   // agent's SUI address
  amountMist: 1000000,       // MIST received (1 SUI = 1e9 MIST)
  txDigest:   "Fz9k...",    // SUI transaction digest
}

// req.suiPayment shape (vault / split mode)
{
  verified: true,
  payer:       "0x24ae...",
  totalMist:   1000000,
  split: {
    publisherMist: 800000,
    poolMist:      150000,
    protocolMist:   50000,
  },
  txDigest: "Fz9k...",
}`}</DocCode>
        </DocSection>

        {/* Env */}
        <DocSection id="env" title="Environment Variables">
          <DocCode lang="bash">{`# Required
SUI_PACKAGE_ID=0xff98a1daa3a52be512b85856a93e749d89bc7d86c36219d53dea54ea9b1d1f9b
SUI_SERVER_SECRET_KEY=suiprivkey1qr9vrgztfcku2a65u9zx09mr02zcd5w8xed7unxhle70hht5wgd92rcl8vk

# Recommended
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_PRICE_MIST=1000000

# Optional — enables split payments
SUI_VAULT_ID=0x...

PORT=3001`}</DocCode>
          <DocCallout type="warning">
            Never commit <DocBadge>SUI_SERVER_SECRET_KEY</DocBadge> to source control.
            The server keypair signs challenge creation transactions and must stay server-side only.
          </DocCallout>
        </DocSection>
      </div>
    </DocLayout>
  );
}
