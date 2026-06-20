"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link2, Globe, Coins, RefreshCw } from "lucide-react";

const REASONS = [
  {
    icon: Link2,
    q: "Why not just use a payment processor?",
    a: "Credit card processors take 2.9% + $0.30 — more than the payment itself at micropayment scale. SUI settles in ~0.5s with sub-cent gas fees. The economics only work on-chain.",
  },
  {
    icon: Globe,
    q: "Why SUI specifically?",
    a: "SUI's object model is a perfect fit: the PaywallChallenge is a shared Move object consumed on payment — that's atomic replay protection with no database. ~500ms finality and sub-cent gas fees make micropayments viable.",
  },
  {
    icon: Coins,
    q: "Why native SUI instead of a stablecoin?",
    a: "SUI is the gas token — agents already hold it to transact. Using native SUI removes the complexity of managing a separate token for both publishers and agents in a hackathon-friendly demo.",
  },
  {
    icon: RefreshCw,
    q: "What stops someone from building a centralized version?",
    a: "Nothing. But on-chain verification means Tollgate's server doesn't need to trust the agent — or be trusted by the agent. The SUI RPC is the neutral arbiter. The Move contract enforces the rules regardless of who runs the server.",
  },
];

export function WhyBlockchain() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-24 border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="section-label">Why Blockchain</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            The honest answer to the obvious question
          </h2>
          <p className="mt-4 text-inkMuted">
            Micropayments require settlement infrastructure with near-zero fees and
            sub-second finality. Existing payment rails weren&apos;t built for $0.001
            transactions. That&apos;s the entire reason blockchain is here — not ideology,
            just math.
          </p>
        </motion.div>

        <div className="mt-12 grid sm:grid-cols-2 gap-5">
          {REASONS.map(({ icon: Icon, q, a }, i) => {
            const cardRef = useRef(null);
            const cardInView = useInView(cardRef, { once: true, margin: "-40px" });
            return (
              <motion.div
                key={q}
                ref={cardRef}
                initial={{ opacity: 0, y: 16 }}
                animate={cardInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: (i % 2) * 0.1 }}
                className="p-5 rounded-xl border border-border bg-raised"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <Icon className="w-4 h-4 text-accent shrink-0" />
                  <h3 className="text-sm font-semibold text-ink">{q}</h3>
                </div>
                <p className="text-sm text-inkMuted leading-relaxed">{a}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mt-12 rounded-xl border border-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-raised">
                  <th className="text-left px-4 py-3 text-inkSubtle font-medium">Settlement method</th>
                  <th className="text-center px-4 py-3 text-inkSubtle font-medium">Cost per $0.001 tx</th>
                  <th className="text-center px-4 py-3 text-inkSubtle font-medium">Finality</th>
                  <th className="text-center px-4 py-3 text-inkSubtle font-medium">Viable?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-surface">
                  <td className="px-4 py-3 text-inkMuted">Stripe / card</td>
                  <td className="px-4 py-3 text-center text-danger font-mono">$0.30+</td>
                  <td className="px-4 py-3 text-center text-inkMuted">1–3 days</td>
                  <td className="px-4 py-3 text-center text-danger">✗</td>
                </tr>
                <tr className="bg-surface">
                  <td className="px-4 py-3 text-inkMuted">Ethereum L1</td>
                  <td className="px-4 py-3 text-center text-danger font-mono">$0.50–$5+</td>
                  <td className="px-4 py-3 text-center text-inkMuted">~12s</td>
                  <td className="px-4 py-3 text-center text-danger">✗</td>
                </tr>
                <tr className="bg-surface">
                  <td className="px-4 py-3 text-inkMuted">Ethereum L2 (Arbitrum)</td>
                  <td className="px-4 py-3 text-center text-yellow-500 font-mono">~$0.01</td>
                  <td className="px-4 py-3 text-center text-inkMuted">~2s</td>
                  <td className="px-4 py-3 text-center text-yellow-500">~</td>
                </tr>
                <tr className="bg-raised">
                  <td className="px-4 py-3 text-ink font-medium">SUI native ← Tollgate</td>
                  <td className="px-4 py-3 text-center text-success font-mono">&lt;$0.001</td>
                  <td className="px-4 py-3 text-center text-success">~500ms</td>
                  <td className="px-4 py-3 text-center text-success">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
