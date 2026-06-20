"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Zap,
  Shield,
  Wallet,
  ScanSearch,
  BarChart3,
  Layers,
} from "lucide-react";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Multi-signal bot detection",
    body: "User-agent patterns and header fingerprinting — scored in-process for low false-positive bot classification with zero network overhead.",
  },
  {
    icon: Shield,
    title: "Intrinsic on-chain replay protection",
    body: "The PaywallChallenge shared object is consumed atomically when pay_and_unlock is called. A second attempt with the same ID fails because the object no longer exists — no database required.",
  },
  {
    icon: Wallet,
    title: "SUI-native, no custodian",
    body: "Payments flow directly from the agent's SUI account to the publisher's address via Move. Tollgate never holds funds or keys.",
  },
  {
    icon: Zap,
    title: "Zero latency for humans",
    body: "Bot detection runs entirely in-process. Human visitors see no overhead — no network call, no redirect, no additional round-trip.",
  },
  {
    icon: Layers,
    title: "Revenue-splitting PublisherVault",
    body: "Create a PublisherVault with basis-point splits across publisher, content pool, and protocol. One PTB atomically routes each payment — no secondary transactions.",
  },
  {
    icon: BarChart3,
    title: "On-chain cumulative analytics",
    body: "The PublisherVault stores total_received_mist and payment_count on-chain. Anyone can read live stats via SUI RPC — no indexer, no API key.",
  },
];

export function Features() {
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
          className="text-center"
        >
          <span className="section-label">Features</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Built for production from day one
          </h2>
        </motion.div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }, i) => {
            const cardRef = useRef(null);
            const cardInView = useInView(cardRef, { once: true, margin: "-40px" });
            return (
              <motion.div
                key={title}
                ref={cardRef}
                initial={{ opacity: 0, y: 16 }}
                animate={cardInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                className="p-5 rounded-xl border border-border bg-raised hover:border-borderStrong transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/15 transition-colors">
                  <Icon className="w-4.5 h-4.5 text-accent w-[18px] h-[18px]" />
                </div>
                <h3 className="text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm text-inkMuted leading-relaxed">{body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
