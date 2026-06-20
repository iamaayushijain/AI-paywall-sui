import 'dotenv/config';
import express from 'express';
import { createPaywall } from 'ai-paywall-sdk-sui';
import { expressMiddleware } from 'ai-paywall-sdk-sui/express';

const app = express();

// ── AI Paywall setup ──────────────────────────────────────────────────────────
const paywall = createPaywall({
  packageId:  process.env.SUI_PACKAGE_ID,
  serverKey:  process.env.SUI_SERVER_SECRET_KEY,
  network:    'testnet',
  priceMist:  1_000_000,        // 0.001 SUI per request
});

app.use('/articles', expressMiddleware(paywall));

// ── Blog routes ───────────────────────────────────────────────────────────────
const ARTICLES = {
  'rise-of-ai-agents': {
    title: 'The Rise of AI Agents',
    author: 'Aayushi Jain',
    date: 'June 2026',
    body: `AI agents are no longer science fiction. They browse the web, write code,
manage calendars, and make purchases — all autonomously. But this creates a new
problem: how do websites and APIs monetise access when the "visitor" is a machine?

Traditional paywalls ask for a login and a credit card. AI agents can't fill out
forms. They need a machine-readable payment protocol — something that is instant,
trustless, and requires zero human intervention.

That is exactly what the HTTP 402 standard was designed for, and with SUI's
Move smart contracts we can finally make it work end-to-end.`,
  },
  'how-tollgate-works': {
    title: 'How Tollgate Works Under the Hood',
    author: 'Aayushi Jain',
    date: 'June 2026',
    body: `Every protected request creates a PaywallChallenge object on the SUI
blockchain. This object holds the price, the publisher address, and an expiry.

The agent builds a Programmable Transaction Block (PTB) that atomically:
  1. Splits the required MIST from its gas coin
  2. Calls pay_and_unlock(challenge, coin, clock)
  3. Emits a PaymentVerified event on-chain

The server reads that event and serves the content. Because consuming the
challenge object is atomic, replay attacks are impossible without a database.`,
  },
};

app.get('/', (_req, res) => {
  res.json({
    blog: 'The AI Economy',
    articles: Object.keys(ARTICLES).map((slug) => ({
      slug,
      title: ARTICLES[slug].title,
      url:   `/articles/${slug}`,
    })),
    note: 'Articles are free for humans, paid for AI agents (0.001 SUI each).',
  });
});

app.get('/articles/:slug', (req, res) => {
  const article = ARTICLES[req.params.slug];
  if (!article) return res.status(404).json({ error: 'Article not found' });

  // req.suiPayment is set by expressMiddleware after a verified payment
  return res.json({
    ...article,
    path: req.path,
    accessedAs: req.suiPayment ? 'agent (paid)' : 'human (free)',
    payment: req.suiPayment ?? null,
  });
});

app.listen(4001, () => {
  console.log('\n  Blog is live at http://localhost:4000');
  console.log('  Articles protected: /articles/*');
  console.log('  Price per agent request: 0.001 SUI\n');
});
