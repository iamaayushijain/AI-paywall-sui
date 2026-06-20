"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Server, Bot, ArrowRight, Check } from "lucide-react";

const PUBLISHER_CODE = `import { createPaywall } from "ai-paywall-sdk-sui";
import { expressMiddleware } from "ai-paywall-sdk-sui/express";

const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,
  serverKey: process.env.SUI_SERVER_SECRET_KEY,
  network: "testnet",
  protect: ["/articles/*", "/blog/*"],
  priceMist: 1_000_000, // 0.001 SUI per crawl
});

app.use(expressMiddleware(paywall));

// req.suiPayment is available on paid routes
app.get("/articles/:slug", (req, res) => {
  res.json({ paid: true, payer: req.suiPayment?.payer });
});`;

const AGENT_CODE = `import {
  createSuiAgentClient,
  fromKeypairFile,
} from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(),         // ~/.sui/sui_config/sui.keystore
  maxPerRequestMist: 10_000_000,     // hard cap: 0.01 SUI per request
  maxTotalMist: 1_000_000_000,       // session budget: 1 SUI
});

// Drop-in fetch — auto-pays 402s, retries transparently
const res = await client.fetch("https://site.com/articles/ai");
const data = await res.json();

console.log("agent address:", client.address());
console.log("spent so far:", client.spend(), "MIST");`;

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="code-block text-inkMuted overflow-x-auto p-4 rounded-lg bg-base border border-border text-xs leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}

export function SDKs() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="sdks" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="section-label">Two SDKs</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            One protocol. Both sides of the market.
          </h2>
          <p className="mt-4 text-inkMuted max-w-2xl mx-auto">
            Publishers gate their content. Agents pay for access. Each SDK is self-contained
            and works independently — install only what your side needs.
          </p>
        </motion.div>

        <div className="mt-16 grid lg:grid-cols-2 gap-6">
          {/* Publisher SDK */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="text-xs text-inkSubtle font-mono">ai-paywall-sdk-sui</div>
                  <div className="text-base font-semibold text-ink">Publisher SDK</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-inkMuted">
                Drop-in middleware for Express and Node.js servers.
                Provide your SUI package ID and server key — payments are verified on-chain.
              </p>
            </div>

            <div className="p-6 space-y-3 flex-1">
              {[
                "Local bot detection — no network call for human visitors",
                "HTTP 402 with a SUI shared-object challenge (PaywallChallenge)",
                "On-chain verification — consuming the object IS the replay protection",
                "Optional PublisherVault for automatic payment splitting (publisher / pool / protocol)",
                "No API key, no signup, no custodian — Move contract only",
                "SUI testnet and mainnet ready",
              ].map((f) => (
                <div key={f} className="flex gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <span className="text-inkMuted">{f}</span>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <CodeBlock code={PUBLISHER_CODE} />
              <Link
                href="/docs/publisher"
                className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:text-accent-light transition-colors font-medium"
              >
                Publisher SDK docs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>

          {/* Agent SDK */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="text-xs text-inkSubtle font-mono">ai-paywall-agent-sdk-sui</div>
                  <div className="text-base font-semibold text-ink">Agent SDK</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-inkMuted">
                Gives any AI agent the ability to pay SUI HTTP 402 paywalls automatically,
                safely, and within configurable MIST budget limits.
              </p>
            </div>

            <div className="p-6 space-y-3 flex-1">
              {[
                "Drop-in client.fetch() — 402s handled automatically and transparently",
                "Hard caps: maxPerRequestMist and maxTotalMist per session",
                "Signer helpers: fromKeypairFile, fromSecretKeyBech32, fromSecretKeyBase64",
                "Supports both simple (pay_and_unlock) and split-vault (pay_and_unlock_split) modes",
                "Budget tracking via client.spend() returns total MIST spent",
                "Typed errors: BudgetExceededError, PaymentRefusedError, UnsupportedChallengeError",
              ].map((f) => (
                <div key={f} className="flex gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <span className="text-inkMuted">{f}</span>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <CodeBlock code={AGENT_CODE} />
              <Link
                href="/docs/agent"
                className="mt-4 inline-flex items-center gap-2 text-sm text-success hover:text-green-400 transition-colors font-medium"
              >
                Agent SDK docs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
