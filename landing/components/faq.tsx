"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Can't AI agents just ignore this like they ignore robots.txt?",
    a: "That's exactly the point — and the answer is no. robots.txt is a text file with no enforcement. Tollgate enforces at the HTTP protocol layer: the server returns HTTP 402 and serves zero bytes of content until a valid, on-chain SUI payment is verified. There's nothing to \"ignore\" — the content physically doesn't arrive without payment. An agent that skips the payment gets a 402 response body, not your article.",
  },
  {
    q: "Does this affect human visitors?",
    a: "No. Bot detection runs locally in-process using user-agent patterns and header fingerprinting. Human browsers pass immediately with zero overhead — no network call, no redirect, no latency added.",
  },
  {
    q: "Where does the money go? Does Tollgate take a cut?",
    a: "Payments flow directly from the agent's SUI account on-chain via the Move contract. Tollgate's server never holds funds, has no custody of keys, and takes no percentage of payments. The only fees are SUI network gas fees (fraction of a cent per transaction). With the PublisherVault, you configure your own split ratios — Tollgate takes nothing by default.",
  },
  {
    q: "How does replay protection work without a database?",
    a: "The PaywallChallenge is a SUI shared object. When pay_and_unlock is called, the object is consumed (deleted) atomically in the same transaction. A second attempt with the same object ID fails because the object no longer exists on-chain — this is enforced at the Move VM level, not application code.",
  },
  {
    q: "What is the PublisherVault?",
    a: "A PublisherVault is a SUI shared object that stores your payment split config in basis points (publisher / pool / protocol). When agents call pay_and_unlock_split, the payment is atomically split and transferred to all three addresses in one PTB — no secondary transactions, no dust loss.",
  },
  {
    q: "What do agents need to integrate on their side?",
    a: "Install ai-paywall-agent-sdk-sui, fund a SUI address, and replace fetch() with client.fetch(). The SDK handles the entire flow — parsing the 402 body, building and submitting the pay_and_unlock PTB, and retrying with X-SUI-PAYMENT-TX and X-SUI-CHALLENGE-ID headers. Vault (split) mode is detected automatically from the 402 body.",
  },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="border border-border rounded-xl overflow-hidden"
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-surface hover:bg-raised transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-ink">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-inkSubtle shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 bg-raised border-t border-border">
              <p className="text-sm text-inkMuted leading-relaxed">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="faq" className="py-24 border-t border-border bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="section-label">FAQ</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Common questions
          </h2>
        </motion.div>

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, i) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
