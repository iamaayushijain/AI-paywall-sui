"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";

export function FinalCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-32 border-t border-border relative overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[800px] h-[400px] rounded-full bg-gradient-radial from-accent/5 via-transparent to-transparent" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-7 h-7 text-accent" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-bold text-ink tracking-tight">
            The consent layer agents{" "}
            <span className="text-accent">can&apos;t ignore.</span>
          </h2>

          <p className="mt-6 text-lg text-inkMuted max-w-xl mx-auto leading-relaxed">
            Two lines of code to gate your content. One install to pay for access.
            USDC in your wallet within 400ms of the agent&apos;s first crawl.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/docs/publisher"
              className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-light text-black font-semibold px-6 py-3 rounded-md transition-colors"
            >
              Read the Docs
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 border border-border hover:border-borderStrong text-inkMuted hover:text-ink px-6 py-3 rounded-md transition-colors"
            >
              Contact Sales
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-8 text-xs text-inkSubtle">
            <span>MIT license</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>No API key required</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Payments direct to your wallet</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
