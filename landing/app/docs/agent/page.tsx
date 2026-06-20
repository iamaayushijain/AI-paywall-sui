import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
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
  { id: "overview",   label: "Overview" },
  { id: "install",    label: "Installation" },
  { id: "quickstart", label: "Quick Start" },
  { id: "signers",    label: "Signers" },
  { id: "config",     label: "Configuration" },
  { id: "vault",      label: "Vault (Split) Mode" },
  { id: "errors",     label: "Error Handling" },
  { id: "spend",      label: "Spend Tracking" },
];

export const metadata = {
  title: "Agent SDK — Tollgate Docs",
  description: "Drop-in fetch replacement for AI agents. Auto-pays SUI HTTP 402 paywalls via pay_and_unlock PTBs.",
};

export default function AgentDocsPage() {
  return (
    <DocLayout sdk="agent" sections={SECTIONS}>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-success" />
          </div>
          <span className="section-label" style={{ color: "var(--success, #22c55e)" }}>Agent SDK</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          ai-paywall-agent-sdk-sui
        </h1>
        <p className="mt-3 text-inkMuted max-w-2xl">
          Drop-in <DocBadge>fetch()</DocBadge> replacement for AI agents. Automatically detects,
          pays, and retries SUI HTTP 402 paywalls. Builds <DocBadge>pay_and_unlock</DocBadge> PTBs
          with configurable MIST budget caps — supports both simple and vault split payment modes.
        </p>
        <div className="mt-4">
          <Link
            href="/docs/publisher"
            className="inline-flex items-center gap-1.5 text-sm text-inkMuted hover:text-ink transition-colors"
          >
            Publishing content? Use the Publisher SDK <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="space-y-0">

        {/* Overview */}
        <DocSection id="overview" title="Overview">
          <DocP>
            Replace <DocBadge>fetch()</DocBadge> with <DocBadge>client.fetch()</DocBadge>.
            On a 200 response, it is a pure passthrough. On a 402, the SDK:
          </DocP>
          <ol className="list-decimal list-inside text-sm text-inkMuted space-y-1.5 mb-4 pl-1">
            <li>Parses the 402 body — extracts the challenge object ID, price in MIST, and Move target</li>
            <li>Checks budget caps (per-request and total)</li>
            <li>Builds and submits a <DocBadge>pay_and_unlock</DocBadge> (or <DocBadge>pay_and_unlock_split</DocBadge>) PTB on SUI</li>
            <li>Retries the original request with <DocBadge>X-SUI-PAYMENT-TX</DocBadge> and <DocBadge>X-SUI-CHALLENGE-ID</DocBadge> headers</li>
            <li>Returns the unlocked <DocBadge>Response</DocBadge></li>
          </ol>
          <DocCallout>
            <strong className="text-accent">Budget is enforced client-side</strong> before the PTB is built.
            A misconfigured server cannot drain your wallet — the cap check happens before any transaction is signed.
          </DocCallout>
        </DocSection>

        {/* Install */}
        <DocSection id="install" title="Installation">
          <DocCode lang="bash">{`npm install ai-paywall-agent-sdk-sui @mysten/sui`}</DocCode>
          <DocP>
            <DocBadge>@mysten/sui</DocBadge> is a peer dependency — your project controls the version.
          </DocP>
          <DocSubSection title="Fund your agent address">
            <DocP>The agent needs SUI to pay for gas and content.</DocP>
            <DocCode lang="bash">{`# Testnet faucet
sui client faucet

# Or visit: https://faucet.sui.io/?address=<your-address>

# Check balance
sui client balance`}</DocCode>
          </DocSubSection>
        </DocSection>

        {/* Quick Start */}
        <DocSection id="quickstart" title="Quick Start">
          <DocCode lang="js">{`import { createSuiAgentClient, fromKeypairFile } from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(),       // reads ~/.sui/sui_config/sui.keystore
  maxPerRequestMist: 10_000_000,   // hard cap: 0.01 SUI per request
  maxTotalMist: 1_000_000_000,     // session budget: 1 SUI

  onPayment: (p) => console.log("paid:", p.txDigest, p.priceMist, "MIST"),
});

// Drop-in fetch — 402s paid automatically
const res = await client.fetch("https://publisher.com/articles/ai-trends");
const data = await res.json();

// Running spend total in MIST
console.log("spent:", client.spend(), "MIST");

// Agent's SUI address
console.log("address:", client.address());`}</DocCode>
        </DocSection>

        {/* Signers */}
        <DocSection id="signers" title="Signers">
          <DocP>
            The SDK needs to sign SUI transactions. Pick the helper that matches your setup.
          </DocP>
          <DocSubSection title="SUI keystore file (default)">
            <DocCode lang="js">{`import { fromKeypairFile } from "ai-paywall-agent-sdk-sui";

signer: fromKeypairFile()                               // ~/.sui/sui_config/sui.keystore
signer: fromKeypairFile("/path/to/sui.keystore")        // custom path`}</DocCode>
          </DocSubSection>
          <DocSubSection title="Bech32 private key (from env)">
            <DocCode lang="js">{`import { fromSecretKeyBech32 } from "ai-paywall-agent-sdk-sui";

// Export key: sui keytool export --key-identity <address>
signer: fromSecretKeyBech32(process.env.SUI_AGENT_SECRET_KEY)`}</DocCode>
          </DocSubSection>
          <DocSubSection title="Base64 key (keystore format)">
            <DocCode lang="js">{`import { fromSecretKeyBase64 } from "ai-paywall-agent-sdk-sui";

signer: fromSecretKeyBase64(process.env.SUI_AGENT_KEY_BASE64)`}</DocCode>
          </DocSubSection>
          <DocSubSection title="Existing Ed25519Keypair">
            <DocCode lang="js">{`import { fromKeypair } from "ai-paywall-agent-sdk-sui";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

signer: fromKeypair(Ed25519Keypair.generate())`}</DocCode>
          </DocSubSection>
        </DocSection>

        {/* Config */}
        <DocSection id="config" title="Configuration">
          <DocP>Pass these options to <DocBadge>createSuiAgentClient({"{ ... }"})</DocBadge>.</DocP>
          <DocTable
            headers={["Option", "Default", "Description"]}
            rows={[
              [<DocBadge key="s">signer</DocBadge>, <span key="r" className="text-danger text-xs">required</span>, "Ed25519Keypair from one of the signer helpers."],
              [<DocBadge key="n">network</DocBadge>, <DocBadge key="nd" color="default">"testnet"</DocBadge>, '"testnet" or "mainnet".'],
              [<DocBadge key="r">rpcUrl</DocBadge>, "public RPC", "Override SUI RPC endpoint. Use a paid RPC in production."],
              [<DocBadge key="mp">maxPerRequestMist</DocBadge>, "unlimited", "Hard per-request cap. Throws BudgetExceededError if exceeded."],
              [<DocBadge key="mt">maxTotalMist</DocBadge>, "unlimited", "Session budget cap. Throws BudgetExceededError when crossed."],
              [<DocBadge key="op">onPayment(info)</DocBadge>, "—", "Callback after each payment: { txDigest, priceMist, challengeObjectId }."],
            ]}
          />
        </DocSection>

        {/* Vault mode */}
        <DocSection id="vault" title="Vault (Split) Mode">
          <DocP>
            When the publisher enables a <DocBadge>PublisherVault</DocBadge>, the 402 response body
            includes <DocBadge>challenge.vaultObjectId</DocBadge>. The agent SDK detects this
            automatically and calls <DocBadge>pay_and_unlock_split</DocBadge> instead of{" "}
            <DocBadge>pay_and_unlock</DocBadge>. No extra configuration required.
          </DocP>
          <DocCode lang="js">{`// The SDK handles both modes transparently.
// The 402 body tells the agent which Move function to call:
//
// Simple mode:
//   challenge.move.target = "0xff98::paywall::pay_and_unlock"
//
// Vault mode (publisher has SUI_VAULT_ID set):
//   challenge.move.target = "0xff98::vault::pay_and_unlock_split"
//   challenge.vaultObjectId = "0x..."
//
// client.fetch() reads these fields and builds the correct PTB.
const res = await client.fetch("https://publisher.com/premium/report");
const data = await res.json();

// In vault mode, data.payment.split shows the breakdown:
// { publisherMist: 800000, poolMist: 150000, protocolMist: 50000 }
console.log(data.payment?.split);`}</DocCode>
        </DocSection>

        {/* Errors */}
        <DocSection id="errors" title="Error Handling">
          <DocP>All SDK errors extend <DocBadge>PaywallError</DocBadge>.</DocP>
          <DocCode lang="js">{`import {
  BudgetExceededError,
  PaymentRefusedError,
  UnsupportedChallengeError,
} from "ai-paywall-agent-sdk-sui";

try {
  const res = await client.fetch("https://publisher.com/article");
  const data = await res.json();
} catch (err) {
  if (err instanceof BudgetExceededError) {
    // Per-request or session budget cap hit.
    // Inspect err.message for details. Do NOT retry with a new client
    // just to get around the cap.

  } else if (err instanceof PaymentRefusedError) {
    // pay_and_unlock TX failed on-chain.
    // Likely insufficient SUI balance or challenge expired.

  } else if (err instanceof UnsupportedChallengeError) {
    // The 402 body is not a Tollgate SUI challenge.
    // May be a different paywall scheme.

  } else {
    throw err;
  }
}`}</DocCode>
          <DocTable
            headers={["Error class", "When it throws"]}
            rows={[
              [<DocBadge key="1">BudgetExceededError</DocBadge>, "Price exceeds maxPerRequestMist or maxTotalMist"],
              [<DocBadge key="2">PaymentRefusedError</DocBadge>, "pay_and_unlock TX failed on SUI (balance, expired, etc.)"],
              [<DocBadge key="3">UnsupportedChallengeError</DocBadge>, "402 body is not a Tollgate SUI challenge"],
            ]}
          />
        </DocSection>

        {/* Spend */}
        <DocSection id="spend" title="Spend Tracking">
          <DocCode lang="js">{`// client.spend() returns total MIST spent this session
console.log(client.spend()); // e.g. 3000000 (3 payments of 0.001 SUI each)

// client.address() returns the paying agent's SUI address
console.log(client.address()); // "0x24ae..."

// Use onPayment to persist receipts across process restarts:
const client = createSuiAgentClient({
  signer: fromKeypairFile(),
  onPayment: async ({ txDigest, priceMist, challengeObjectId }) => {
    await db.insert({ txDigest, priceMist, ts: new Date() });
  },
});`}</DocCode>
          <DocP>
            The spend counter resets when the client is re-created (per Node.js process).
            For persistent tracking, use the <DocBadge>onPayment</DocBadge> hook.
          </DocP>
        </DocSection>

      </div>
    </DocLayout>
  );
}
