"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { FileX, DollarSign, ShieldOff } from "lucide-react";

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4 }}
      className="border border-border rounded-xl p-6 bg-surface"
    >
      <div className="text-3xl font-bold text-accent">{value}</div>
      <div className="mt-1 text-sm font-medium text-ink">{label}</div>
      <div className="mt-1 text-xs text-inkSubtle">{sub}</div>
    </motion.div>
  );
}

export function Problem() {
  const headRef = useRef(null);
  const inView = useInView(headRef, { once: true, margin: "-60px" });

  return (
    <section id="problem" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          ref={headRef}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="section-label">The Problem</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Agents scrape billions of pages.{" "}
            <span className="text-inkMuted">Publishers get nothing.</span>
          </h2>
          <p className="mt-4 text-inkMuted text-lg leading-relaxed">
            AI companies train on, summarize, and resell your content at scale.
            robots.txt asks them nicely to stop. Most don&apos;t, because there
            is no cost to ignoring it — it&apos;s an honor system with no honor
            and no enforcement. Tollgate changes the economics: access requires
            payment, and payment is verified on-chain before a byte of content
            is served.
          </p>
        </motion.div>

        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          <StatCard
            value="100B+"
            label="Pages crawled daily by AI bots"
            sub="With zero publisher compensation"
          />
          <StatCard
            value="$0"
            label="Revenue from robots.txt compliance"
            sub="It was always just a suggestion"
          />
          <StatCard
            value="~0ms"
            label="Time an agent spends deciding to ignore robots.txt"
            sub="There is no cost to ignoring it"
          />
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: FileX,
              title: "robots.txt is unenforceable",
              body: "No mechanism exists to prevent a bot from simply reading your content anyway. It's a text file.",
            },
            {
              icon: ShieldOff,
              title: "Blocking by user-agent is whack-a-mole",
              body: "Agents change user-agents, rotate IPs, and use residential proxies. You can't block what you can't reliably detect.",
            },
            {
              icon: DollarSign,
              title: "The consent layer needs teeth",
              body: "The only reliable enforcement is economic. If access costs money and payment is verified on-chain, the math changes.",
            },
          ].map(({ icon: Icon, title, body }, i) => {
            const ref = useRef(null);
            const inV = useInView(ref, { once: true, margin: "-40px" });
            return (
              <motion.div
                key={title}
                ref={ref}
                initial={{ opacity: 0, y: 16 }}
                animate={inV ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex gap-4 p-5 rounded-xl border border-border bg-surface"
              >
                <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">{title}</div>
                  <div className="mt-1 text-sm text-inkMuted">{body}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
