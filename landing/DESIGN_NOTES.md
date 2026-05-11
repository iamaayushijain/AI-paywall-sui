# Tollgate — Design Notes

## Chosen Name: Tollgate

**Rationale**: A tollgate is real enforcement infrastructure — not a polite notice. The highway tollgate metaphor maps exactly to the product's core value proposition: you pay to pass, or you don't pass. Unlike robots.txt (a text file any agent can ignore), a tollgate is physical. The name earns its tagline: *"robots.txt was a suggestion. Tollgate isn't."*

Rejected alternatives:
- **CrawlPay** — appears as an internal namespace in the codebase (`crawlpay.challenge.token`), which makes it accurate but too feature-named vs. brand-named.
- **x402** — leverages the HTTP standard, but risks confusion with the existing `@x402-solana` npm package family that Tollgate depends on.

---

## Visual Direction: Developer-Terminal

Chosen aesthetic: **Vercel/Linear developer-terminal**, committed fully.

**Why**: Tollgate is developer infrastructure. It uses blockchain incidentally (because the economics demand it), but the primary audience is engineers and publishers who care about the HTTP protocol, the npm install, and the Solana wallet flow — not token aesthetics. The terminal aesthetic matches that context and sets accurate expectations.

**Rejected alternatives**:
- **Web3 gradient-glow (Phantom)**: Would make Tollgate look like a DeFi product. It isn't.
- **Editorial brutalist (Arc/Cursor)**: Interesting but harder to maintain consistency at this build size, and mismatched with the "serious infra" positioning.

---

## Color Palette

Defined in `tailwind.config.ts` under `theme.extend.colors`:

| Token | Value | Intent |
|-------|-------|--------|
| `base` | `#0a0a0a` | Page background — near-black, not pure black |
| `surface` | `#111111` | Card / section background, one step lighter |
| `raised` | `#1a1a1a` | Elevated panels, code blocks |
| `overlay` | `#222222` | Modals, tooltips |
| `border` | `#2a2a2a` | Default borders — low contrast, structural only |
| `borderStrong` | `#404040` | Emphasized dividers / hover state borders |
| `ink` | `#fafafa` | Primary text |
| `inkMuted` | `#a3a3a3` | Secondary text, labels, body copy |
| `inkSubtle` | `#525252` | Placeholder, disabled, meta text |
| `accent` | `#f59e0b` | Brand accent — amber/gold |
| `accent.dark` | `#d97706` | CTA pressed state |
| `accent.light` | `#fbbf24` | CTA hover state |
| `accent.glow` | `rgba(245,158,11,0.15)` | Glow backgrounds |
| `success` | `#22c55e` | Verified / confirmed / payment received |
| `danger` | `#ef4444` | Error / rejected |

**Accent rationale**: Amber/gold was chosen over blue-purple (too generic SaaS), green (too much Solana-branding, and would compete with the `success` success state), and red (too alarming for a neutral tool). Gold reads as "money/payment" without being garish, and has high contrast on dark surfaces.

---

## Type Scale

Uses Next.js `next/font/google` (Inter, subset `latin`) loaded as a CSS variable (`--font-inter`). Monospace uses the system monospace stack (`--font-mono`).

Scale follows Tailwind defaults (`xs` → `7xl`) — no custom overrides needed. Key usage patterns:
- Hero headline: `text-4xl sm:text-5xl lg:text-6xl font-bold`
- Section heading: `text-3xl sm:text-4xl font-bold`
- Card title: `text-base font-semibold`
- Body: `text-sm text-inkMuted leading-relaxed`
- Labels/section markers: `text-[11px] font-semibold uppercase tracking-[0.1em] text-accent`
- Code: `code-block` utility class (monospace, 13px, line-height 1.6)

---

## SDK Feature Assumptions

All features described in the landing page are derived directly from the source code and READMEs — no invented capabilities.

**Publisher SDK (tollgate-sdk v0.2.0)**:
- Bot detection: reads from `packages/ai-paywall-sdk/src/core/botDetector.js`
- Adapters confirmed from `package.json#exports`: `./express`, `./nextjs`, `./fastify`, `./cloudflare`
- `createPaywall()`, `expressMiddleware()`, `paywallMiddleware()`, `withRouteHandler()`, `fastifyPlugin`, `cloudflareHandler` — all confirmed in source
- `req.paywallPayment`, `onDetection`, `failOpen` — confirmed in `paywall.js`
- Sign-In With Solana dashboard — referenced in README
- Zero Solana deps on server — confirmed (no `@solana/web3.js` in publisher SDK deps)

**Agent SDK (tollgate-agent-sdk v0.1.0)**:
- `createAgentPaywallClient()`, `client.fetch()`, `client.spend()`, `client.payChallenge()` — confirmed in `client.js`
- Signer helpers: `fromKeypair`, `fromSecretKeyArray`, `fromSecretKeyBase58`, `fromKeypairFile` — confirmed in `signer.js` exports
- `paywallFetchTool()` — confirmed in `tools/langchain.js`
- Request coalescing — confirmed in `client.js` (`tracker.coalesce()`)
- Typed errors — confirmed in `errors.js` exports
- Budget tracking via `createSpendTracker` — confirmed in `spendTracker.js`

**Chain**: Solana devnet + mainnet-beta — confirmed in `verifyPayment.js` (`SOLANA_NETWORK` env var logic)

**Payment**: USDC SPL token — Circle's devnet faucet mint confirmed in code; mainnet `EPjFWdd5...` confirmed

**Protocol**: x402 (`@x402-solana/core` for `parseX402Payment`, custom verification for USDC balance delta check)

---

## Architecture Decisions

- **Self-contained**: `/landing` has its own `package.json`, `node_modules`, and build — does not import from parent repo
- **No external image CDN**: All visuals composed from SVG (flow diagram in `how-it-works.tsx`) and lucide-react icons
- **Framer Motion usage**: `useInView` + `motion.div` for scroll-triggered fade-up; `AnimatePresence` for tab switches and mobile nav. No animation theater — transitions are 0.2–0.5s max
- **Dark mode**: hardcoded via `<html className="dark">` — no toggle implemented (dark mode default is the design intent; adding a toggle would require additional state management not in scope)
- **Contact form**: Structure only, no backend. `sent` state flips to a confirmation view on submit
- **Routes**: `/` (landing), `/download` (install commands), `/contact` (sales form)
