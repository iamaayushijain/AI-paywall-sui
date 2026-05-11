import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tollgate — The consent layer AI agents can't ignore",
  description:
    "robots.txt was a suggestion. Tollgate isn't. Drop-in HTTP 402 paywall for publishers. Auto-pay client for AI agents. USDC micropayments on Solana, settled on-chain.",
  keywords: [
    "AI paywall",
    "HTTP 402",
    "x402",
    "Solana",
    "USDC",
    "AI agent monetization",
    "web scraping monetization",
    "bot paywall",
  ],
  openGraph: {
    title: "Tollgate — The consent layer AI agents can't ignore",
    description:
      "Drop-in HTTP 402 paywall for publishers. Auto-pay SDK for AI agents. USDC micropayments on Solana.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans bg-base text-ink antialiased`}
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
