"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Shield } from "lucide-react";
import Link from "next/link";

const links = [
  { href: "#problem", label: "The Problem" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#sdks", label: "SDKs" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-base/90 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center group-hover:bg-accent-light transition-colors">
            <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-ink tracking-tight">Tollgate</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-inkMuted hover:text-ink transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/contact"
            className="text-sm text-inkMuted hover:text-ink transition-colors px-3 py-1.5"
          >
            Contact Sales
          </Link>
          <Link
            href="/download"
            className="text-sm bg-accent hover:bg-accent-light text-black font-semibold px-4 py-1.5 rounded-md transition-colors"
          >
            Get SDK
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-inkMuted hover:text-ink transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-surface border-b border-border overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm text-inkMuted hover:text-ink transition-colors py-1"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Link
                  href="/download"
                  className="text-sm bg-accent hover:bg-accent-light text-black font-semibold px-4 py-2 rounded-md text-center transition-colors"
                >
                  Get SDK
                </Link>
                <Link
                  href="/contact"
                  className="text-sm border border-border text-inkMuted hover:text-ink px-4 py-2 rounded-md text-center transition-colors"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
