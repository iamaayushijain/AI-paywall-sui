"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Copy, Check, Terminal } from "lucide-react";

type Tab = "publisher-install" | "publisher-express" | "publisher-vault" | "agent-install" | "agent-basic" | "agent-vault";

const TABS: { id: Tab; label: string; side: "publisher" | "agent" }[] = [
  { id: "publisher-install", label: "Install", side: "publisher" },
  { id: "publisher-express", label: "Express", side: "publisher" },
  { id: "publisher-vault", label: "Vault Split", side: "publisher" },
  { id: "agent-install", label: "Install", side: "agent" },
  { id: "agent-basic", label: "Basic", side: "agent" },
  { id: "agent-vault", label: "Vault Mode", side: "agent" },
];

const CODE: Record<Tab, { lang: string; code: string }> = {
  "publisher-install": {
    lang: "bash",
    code: `npm install ai-paywall-sdk-sui @mysten/sui

# Required environment variables:
SUI_PACKAGE_ID=0xff98a1daa3a52be512b85856a93e749d...
SUI_SERVER_SECRET_KEY=suiprivkey1qr9vrgztfcku2a65...
SUI_NETWORK=testnet`,
  },
  "publisher-express": {
    lang: "js",
    code: `import express from "express";
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

app.get("/articles/:slug", (req, res) => {
  // req.suiPayment is set when payment is verified
  res.json({ content: "...", payer: req.suiPayment?.payer });
});`,
  },
  "publisher-vault": {
    lang: "js",
    code: `import { createPaywall } from "ai-paywall-sdk-sui";
import { expressMiddleware } from "ai-paywall-sdk-sui/express";

// Enable PublisherVault for automatic revenue splitting:
// publisher 80% / content pool 15% / protocol 5%
// Create vault once via POST /sui/v1/vault/create,
// then set SUI_VAULT_ID in your environment.
const paywall = createPaywall({
  packageId: process.env.SUI_PACKAGE_ID,
  serverKey: process.env.SUI_SERVER_SECRET_KEY,
  network: "testnet",
  priceMist: 1_000_000,

  // Agents will call pay_and_unlock_split instead of pay_and_unlock.
  // Payment is atomically split in a single Move PTB.
  vaultId: process.env.SUI_VAULT_ID,
});

app.use(expressMiddleware(paywall));`,
  },
  "agent-install": {
    lang: "bash",
    code: `npm install ai-paywall-agent-sdk-sui @mysten/sui

# Peer dep — keeps your project in control of SUI SDK version.
# Fund the agent address before running:
# sui client faucet --address <your-address>`,
  },
  "agent-basic": {
    lang: "js",
    code: `import {
  createSuiAgentClient,
  fromKeypairFile,
  BudgetExceededError,
} from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(), // ~/.sui/sui_config/sui.keystore
  maxPerRequestMist: 10_000_000,  // hard cap: 0.01 SUI/request
  maxTotalMist: 1_000_000_000,    // session budget: 1 SUI

  onPayment: (p) => console.log("paid:", p.txDigest, p.priceMist),
});

try {
  const res = await client.fetch("https://yoursite.com/articles/ai");
  const data = await res.json();
  console.log("spent:", client.spend(), "MIST");
} catch (err) {
  if (err instanceof BudgetExceededError) {
    // Budget cap hit — do not retry
  }
}`,
  },
  "agent-vault": {
    lang: "js",
    code: `import { createSuiAgentClient, fromKeypairFile } from "ai-paywall-agent-sdk-sui";

const client = createSuiAgentClient({
  network: "testnet",
  signer: fromKeypairFile(),
  maxPerRequestMist: 10_000_000,
});

// If the server is in vault (split) mode, the 402 body includes:
// challenge.vaultObjectId — client detects this automatically and
// calls pay_and_unlock_split instead of pay_and_unlock.
// No extra config required — the client handles both modes.

const res = await client.fetch("https://yoursite.com/premium/article");
const data = await res.json();

// data.payment.split shows publisher/pool/protocol breakdown:
// { publisherMist: 800000, poolMist: 150000, protocolMist: 50000 }
console.log(data.payment?.split);`,
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded text-inkSubtle hover:text-inkMuted transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function CodeInAction() {
  const [active, setActive] = useState<Tab>("publisher-install");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const publisherTabs = TABS.filter((t) => t.side === "publisher");
  const agentTabs = TABS.filter((t) => t.side === "agent");
  const current = CODE[active];

  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="section-label">Code In Action</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Integration takes minutes, not days
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mt-12 rounded-xl border border-border bg-surface overflow-hidden"
        >
          {/* Tab bar */}
          <div className="border-b border-border bg-raised">
            <div className="flex items-center px-4 overflow-x-auto">
              {/* Publisher group */}
              <div className="flex items-center gap-0.5 mr-4">
                <span className="text-xs text-inkSubtle font-mono pr-3 border-r border-border mr-1 shrink-0">Publisher</span>
                {publisherTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={`px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                      active === t.id
                        ? "text-accent border-accent"
                        : "text-inkSubtle border-transparent hover:text-inkMuted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border shrink-0" />

              {/* Agent group */}
              <div className="flex items-center gap-0.5 ml-4">
                <span className="text-xs text-inkSubtle font-mono pr-3 border-r border-border mr-1 shrink-0">Agent</span>
                {agentTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={`px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                      active === t.id
                        ? "text-success border-success"
                        : "text-inkSubtle border-transparent hover:text-inkMuted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Code area */}
          <div className="relative">
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="text-xs text-inkSubtle font-mono">{current.lang}</span>
              <CopyButton text={current.code} />
            </div>

            <AnimatePresence mode="wait">
              <motion.pre
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="code-block text-inkMuted p-6 pt-10 overflow-x-auto min-h-[240px]"
              >
                <code>{current.code}</code>
              </motion.pre>
            </AnimatePresence>
          </div>

          {/* Footer bar */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-inkSubtle" />
            <span className="text-xs text-inkSubtle">
              {active.startsWith("publisher") ? "ai-paywall-sdk-sui" : "ai-paywall-agent-sdk-sui"} v1.0.0 — MIT license — SUI Move
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
