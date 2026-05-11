"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ArrowLeft, Send, Check } from "lucide-react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    message: "",
    volume: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No backend — structure only
    setSent(true);
  }

  return (
    <main>
      <Nav />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-inkSubtle hover:text-inkMuted transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <span className="section-label">Contact Sales</span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          Talk to us about Enterprise
        </h1>
        <p className="mt-3 text-inkMuted">
          Volume pricing, dedicated infrastructure, custom terms, and a private Slack channel.
          Fill out the form and we&apos;ll respond within one business day.
        </p>

        {sent ? (
          <div className="mt-12 rounded-xl border border-success/30 bg-success/5 p-8 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-ink">We&apos;ll be in touch</h2>
            <p className="text-sm text-inkMuted">
              Thanks for reaching out. Expect a reply within one business day.
            </p>
            <Link
              href="/"
              className="text-sm text-accent hover:text-accent-light transition-colors"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Name" name="name" value={form.name} onChange={handleChange} required placeholder="Ada Lovelace" />
              <Field label="Work Email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="ada@acmecorp.com" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Company" name="company" value={form.company} onChange={handleChange} placeholder="Acme Corp" />
              <Field label="Your Role" name="role" value={form.role} onChange={handleChange} placeholder="CTO / Head of Engineering" />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkMuted mb-2">
                Expected monthly crawl volume
              </label>
              <select
                name="volume"
                value={form.volume}
                onChange={handleChange}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">Select a range...</option>
                <option value="under-100k">Under 100K requests/mo</option>
                <option value="100k-1m">100K – 1M requests/mo</option>
                <option value="1m-10m">1M – 10M requests/mo</option>
                <option value="10m+">10M+ requests/mo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-inkMuted mb-2">
                Tell us more
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={4}
                placeholder="What you're building, any specific requirements, questions about deployment..."
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-inkSubtle focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-black font-semibold px-5 py-2.5 rounded-md transition-colors text-sm"
            >
              Send message
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      <Footer />
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-inkMuted mb-2">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-inkSubtle focus:outline-none focus:border-accent transition-colors"
      />
    </div>
  );
}
