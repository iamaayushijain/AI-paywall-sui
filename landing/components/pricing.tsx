"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to ship and collect payments.",
    cta: { label: "Get the SDK", href: "/download" },
    highlight: false,
    features: [
      "Both SDKs, MIT license",
      "Unlimited payments (you keep 100%)",
      "Solana devnet + mainnet-beta",
      "Express, Next.js, Fastify, Cloudflare adapters",
      "LangChain tool integration",
      "Bot detection: UA, headers, IP, rDNS",
      "Community support (GitHub Issues)",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/ month",
    description: "Hosted facilitator, dashboard, and priority support.",
    cta: { label: "Get Started", href: "/download" },
    highlight: true,
    features: [
      "Everything in Free",
      "Hosted facilitator (no self-hosting required)",
      "Dashboard: payments, top bots, top pages",
      "Sign-In With Solana analytics",
      "Webhook events per payment",
      "Priority email support",
      "SLA: 99.9% uptime",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Volume pricing, dedicated infrastructure, custom terms.",
    cta: { label: "Contact Sales", href: "/contact" },
    highlight: false,
    features: [
      "Everything in Pro",
      "Dedicated Solana RPC",
      "Custom USDC mint support",
      "On-premise / private cloud deployment",
      "Custom allowlist rules per wallet",
      "Volume discounts",
      "Dedicated Slack channel + SLA",
    ],
  },
];

export function Pricing() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="pricing" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="section-label">Pricing</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            You keep every cent of payments received
          </h2>
          <p className="mt-4 text-inkMuted max-w-xl mx-auto">
            Tollgate never takes a cut of on-chain payments. The plan fee covers
            infrastructure and support — the USDC goes straight to your wallet.
          </p>
        </motion.div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => {
            const cardRef = useRef(null);
            const cardInView = useInView(cardRef, { once: true, margin: "-40px" });
            return (
              <motion.div
                key={plan.name}
                ref={cardRef}
                initial={{ opacity: 0, y: 20 }}
                animate={cardInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`rounded-xl border flex flex-col overflow-hidden ${
                  plan.highlight
                    ? "border-accent bg-surface glow-accent-sm"
                    : "border-border bg-surface"
                }`}
              >
                {plan.highlight && (
                  <div className="bg-accent text-black text-xs font-semibold text-center py-1.5 px-4">
                    Most Popular
                  </div>
                )}

                <div className="p-6 border-b border-border">
                  <div className="text-sm font-semibold text-inkMuted">{plan.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-ink">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm text-inkSubtle">{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-inkMuted">{plan.description}</p>
                </div>

                <div className="p-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex gap-2.5 text-sm">
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          plan.highlight ? "text-accent" : "text-success"
                        }`}
                      />
                      <span className="text-inkMuted">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="p-6 pt-0">
                  <Link
                    href={plan.cta.href}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? "bg-accent hover:bg-accent-light text-black"
                        : "border border-border hover:border-borderStrong text-inkMuted hover:text-ink"
                    }`}
                  >
                    {plan.cta.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-inkSubtle">
          All plans include both SDKs under MIT license. No transaction fee from Tollgate — only Solana network fees (~$0.00025/tx).
        </p>
      </div>
    </section>
  );
}
