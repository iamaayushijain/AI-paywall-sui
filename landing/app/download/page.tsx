"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Shield, Server, Bot, Copy, Check, ArrowLeft } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs text-inkSubtle hover:text-inkMuted transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function InstallBlock({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-base border border-border rounded-lg px-4 py-3">
      <code className="code-block text-inkMuted text-sm flex-1">{cmd}</code>
      <CopyButton text={cmd} />
    </div>
  );
}

export default function DownloadPage() {
  return (
    <main>
      <Nav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-inkSubtle hover:text-inkMuted transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <span className="section-label">Download</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          Install Tollgate SDKs
        </h1>
        <p className="mt-3 text-inkMuted max-w-xl">
          Both SDKs are MIT-licensed and published to npm. SUI peer dependency required.
          Install only what your side of the market needs.
        </p>

        {/* Publisher SDK */}
        <section id="publisher" className="mt-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Server className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="text-xs text-inkSubtle font-mono">ai-paywall-sdk-sui</div>
              <h2 className="text-xl font-semibold text-ink">Publisher SDK</h2>
            </div>
          </div>

          <p className="text-sm text-inkMuted mb-5">
            Drop-in middleware for Express. Provide your SUI package ID and server key —
            payments are verified on-chain via Move. No database, no custodian.
          </p>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-inkSubtle mb-2 font-medium">Install</div>
              <InstallBlock cmd="npm install ai-paywall-sdk-sui @mysten/sui" />
            </div>

            <div>
              <div className="text-xs text-inkSubtle mb-2 font-medium">Express</div>
              <InstallBlock cmd='import { createPaywall } from "ai-paywall-sdk-sui"; import { expressMiddleware } from "ai-paywall-sdk-sui/express";' />
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border border-border bg-surface">
            <div className="text-xs text-inkSubtle mb-2 font-medium">Minimum config</div>
            <pre className="code-block text-inkMuted text-xs">{`const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,
  serverKey: process.env.SUI_SERVER_SECRET_KEY,
  network: "testnet",
  priceMist: 1_000_000, // 0.001 SUI per crawl
});

app.use(expressMiddleware(paywall));
// req.suiPayment set on paid requests`}</pre>
          </div>
        </section>

        {/* Divider */}
        <div className="my-12 border-t border-border" />

        {/* Agent SDK */}
        <section id="agent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-success" />
            </div>
            <div>
              <div className="text-xs text-inkSubtle font-mono">ai-paywall-agent-sdk-sui</div>
              <h2 className="text-xl font-semibold text-ink">Agent SDK</h2>
            </div>
          </div>

          <p className="text-sm text-inkMuted mb-5">
            Drop-in SUI paywall client for AI agents. Automatically detects, pays, and retries
            HTTP 402 challenges via pay_and_unlock PTBs.
          </p>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-inkSubtle mb-2 font-medium">Install</div>
              <InstallBlock cmd="npm install ai-paywall-agent-sdk-sui @mysten/sui" />
            </div>
            <div>
              <div className="text-xs text-inkSubtle mb-2 font-medium">Signers</div>
              <InstallBlock cmd='import { fromKeypairFile, fromSecretKeyBech32 } from "ai-paywall-agent-sdk-sui";' />
            </div>
            <div>
              <div className="text-xs text-inkSubtle mb-2 font-medium">Error types</div>
              <InstallBlock cmd='import { BudgetExceededError, PaymentRefusedError } from "ai-paywall-agent-sdk-sui";' />
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border border-border bg-surface">
            <div className="text-xs text-inkSubtle mb-2 font-medium">Minimum config</div>
            <pre className="code-block text-inkMuted text-xs">{`import { createSuiAgentClient, fromKeypairFile } from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(),       // ~/.sui/sui_config/sui.keystore
  maxPerRequestMist: 10_000_000,   // hard cap: 0.01 SUI/request
  maxTotalMist: 1_000_000_000,     // session budget: 1 SUI
});

const res = await client.fetch("https://site.com/article");
console.log("spent:", client.spend(), "MIST");`}</pre>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
