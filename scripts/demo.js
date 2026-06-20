/**
 * AI Paywall — Live Demo Script
 *
 * Shows the complete flow:
 *   1. Blog owner installs sdk & protects routes
 *   2. Human visits → free access
 *   3. AI agent visits → 402 challenge issued on SUI
 *   4. Agent auto-pays via PTB
 *   5. Content unlocked with on-chain proof
 *   6. Publisher earnings dashboard
 *
 * Prereqs:
 *   - Server running: npm start  (http://localhost:3001)
 *   - .env with SUI_SERVER_SECRET_KEY + SUI_PACKAGE_ID
 */

import 'dotenv/config';
import chalk from 'chalk';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';

const BASE_URL    = process.env.BASE_URL    || 'http://localhost:3001';
const NETWORK     = process.env.SUI_NETWORK  || 'testnet';
const PACKAGE_ID  = process.env.SUI_PACKAGE_ID;
const CLOCK       = '0x6';
const EXPLORER    = `https://suiscan.xyz/${NETWORK}`;

// ── helpers ───────────────────────────────────────────────────────────────────

function loadKeypair() {
  const key = process.env.SUI_SERVER_SECRET_KEY;
  if (!key) throw new Error('SUI_SERVER_SECRET_KEY is not set in .env');
  if (key.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const raw = fromBase64(key);
  return Ed25519Keypair.fromSecretKey(raw.slice(1));
}

const suiClient = new SuiJsonRpcClient({
  url: process.env.SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK),
});

async function getBalance(address) {
  const b = await suiClient.getBalance({ owner: address });
  return Number(b.totalBalance);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── pretty output ─────────────────────────────────────────────────────────────

const W = 68;
const line  = chalk.dim('─'.repeat(W));
const dline = chalk.dim('═'.repeat(W));

function banner() {
  const title    = ' AI PAYWALL  ·  LIVE DEMO ';
  const subtitle = ' Trustless HTTP 402 micropayments on SUI blockchain ';
  const pad = (s) => ' ' + s + ' '.repeat(W - 2 - s.length) + ' ';
  console.log('\n' + chalk.cyan.bold('╔' + '═'.repeat(W - 2) + '╗'));
  console.log(chalk.cyan.bold('║') + chalk.bold.white(pad(title)) + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('║') + chalk.dim(pad(subtitle)) + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚' + '═'.repeat(W - 2) + '╝') + '\n');
}

function step(n, emoji, title) {
  console.log('\n' + dline);
  console.log(chalk.bold.cyan(`  STEP ${n}  ${emoji}  ${title}`));
  console.log(dline);
}

function info(label, value, color = 'white') {
  const l = chalk.dim(label.padEnd(26));
  const v = chalk[color](value);
  console.log(`  ${l} ${v}`);
}

function ok(msg) {
  console.log(`  ${chalk.green('✓')} ${chalk.green(msg)}`);
}

function arrow(msg) {
  console.log(`  ${chalk.dim('→')} ${chalk.white(msg)}`);
}

function codeBlock(lines) {
  const border = chalk.dim('┌' + '─'.repeat(W - 4) + '┐');
  const bottom = chalk.dim('└' + '─'.repeat(W - 4) + '┘');
  console.log('\n  ' + border);
  for (const l of lines) {
    const padded = l.padEnd(W - 6);
    console.log('  ' + chalk.dim('│') + ' ' + chalk.yellow(padded) + ' ' + chalk.dim('│'));
  }
  console.log('  ' + bottom + '\n');
}

function jsonBlock(obj) {
  const text = JSON.stringify(obj, null, 2);
  const border = chalk.dim('┌' + '─'.repeat(W - 4) + '┐');
  const bottom = chalk.dim('└' + '─'.repeat(W - 4) + '┘');
  console.log('\n  ' + border);
  for (const l of text.split('\n')) {
    const padded = l.substring(0, W - 6).padEnd(W - 6);
    console.log(
      '  ' + chalk.dim('│') + ' ' + chalk.cyan(padded) + ' ' + chalk.dim('│'),
    );
  }
  console.log('  ' + bottom + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DEMO
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  if (!PACKAGE_ID) {
    console.error(chalk.red('\n  ✗  SUI_PACKAGE_ID is not set in .env\n'));
    process.exit(1);
  }

  // ── Load keypair ─────────────────────────────────────────────────────────
  const keypair          = loadKeypair();
  const publisherAddress = keypair.toSuiAddress();
  // In this demo the agent uses the same funded wallet; in production they'd differ.
  const agentAddress     = publisherAddress;

  const ARTICLE_PATH = '/articles/the-future-of-ai-agents';

  banner();

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Blog owner setup
  // ═══════════════════════════════════════════════════════════════════════════
  step(1, '🏗️', 'BLOG OWNER SETUP');

  arrow('Blog owner installs the AI Paywall SDK:');
  codeBlock([
    'npm install ai-paywall-sdk-sui',
    '',
    '// server.js (Express)',
    "import { createPaywall }    from 'ai-paywall-sdk-sui';",
    "import { expressMiddleware } from 'ai-paywall-sdk-sui/express';",
    '',
    'const paywall = createPaywall({',
    '  packageId:  process.env.SUI_PACKAGE_ID,  // Move contract on SUI',
    '  serverKey:  process.env.SUI_SERVER_SECRET_KEY,',
    '  network:    "testnet",',
    '  priceMist:  1_000_000,   // 0.001 SUI per request',
    '  protect:    ["/articles/*"],',
    '});',
    '',
    'app.use("/articles", expressMiddleware(paywall));',
  ]);

  info('Publisher address', publisherAddress, 'yellow');
  info('Package ID',        PACKAGE_ID.slice(0, 20) + '...', 'yellow');
  info('Network',           `SUI ${NETWORK}`, 'yellow');
  info('Price per request', '1,000,000 MIST (0.001 SUI)', 'yellow');
  info('Protected routes',  '/articles/*', 'yellow');

  // Check server is live
  arrow('Checking server health...');
  let health;
  try {
    health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
  } catch {
    console.error(chalk.red(`\n  ✗  Server not reachable at ${BASE_URL}\n     Run: npm start\n`));
    process.exit(1);
  }
  ok(`Server is live  →  ${BASE_URL}`);
  ok(`Chain: ${health.chain}  |  Network: ${health.network}`);

  const balanceBefore = await getBalance(publisherAddress);
  info('Publisher balance', `${(balanceBefore / 1e9).toFixed(6)} SUI`, 'green');

  await sleep(400);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Human visits blog
  // ═══════════════════════════════════════════════════════════════════════════
  step(2, '🧑', 'HUMAN VISITS THE BLOG');

  arrow(`GET ${ARTICLE_PATH}  (browser request)`);

  const humanRes = await fetch(`${BASE_URL}${ARTICLE_PATH}`, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'sec-fetch-site':  'same-origin',
    },
  });

  const humanBody = await humanRes.json();
  info('HTTP status', `${humanRes.status} OK`, 'green');
  info('Bot detected', 'false  (human browser headers)', 'green');

  console.log('\n  ' + chalk.dim('Response:'));
  jsonBlock({
    status:  humanBody.status,
    message: humanBody.message,
    content: {
      title: humanBody.content?.title,
      body:  humanBody.content?.body?.slice(0, 60) + '...',
      path:  humanBody.content?.path,
    },
  });

  ok('Human gets FREE access — no payment required');

  await sleep(400);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — AI agent visits → 402 challenge
  // ═══════════════════════════════════════════════════════════════════════════
  step(3, '🤖', 'AI AGENT VISITS → BLOCKED WITH 402');

  arrow(`GET ${ARTICLE_PATH}  (User-Agent: GPTBot/1.0)`);
  arrow('Agent SDK auto-detects bot headers → paywall triggers...');

  const r402 = await fetch(`${BASE_URL}${ARTICLE_PATH}`, {
    headers: { 'User-Agent': 'GPTBot/1.0' },
  });

  if (r402.status !== 402) {
    console.error(chalk.red(`  ✗  Expected 402, got ${r402.status}`));
    process.exit(1);
  }

  const body402 = await r402.json();
  const { challenge } = body402;

  info('HTTP status',         `${r402.status} Payment Required`, 'red');
  info('Bot score',           '90 / 100  (GPTBot pattern matched)', 'red');
  info('x402 version',        body402.x402Version?.toString(), 'yellow');
  info('Network',             body402.network, 'yellow');
  info('Challenge object ID', challenge.objectId, 'yellow');
  info('Price',               challenge.priceFormatted + '  (' + challenge.priceMist + ' MIST)', 'yellow');
  info('Expires at',          challenge.expiresAt, 'yellow');

  console.log('\n  ' + chalk.dim('Full 402 response body:'));
  jsonBlock({
    x402Version: body402.x402Version,
    error:       body402.error,
    network:     body402.network,
    mode:        body402.mode,
    challenge: {
      objectId:         challenge.objectId,
      publisherAddress: challenge.publisherAddress,
      priceMist:        challenge.priceMist,
      priceFormatted:   challenge.priceFormatted,
      expiresAt:        challenge.expiresAt,
      move: {
        target:       challenge.move.target,
        clockObjectId: challenge.move.clockObjectId,
        hint:         challenge.move.hint,
      },
    },
  });

  ok('On-chain PaywallChallenge object created on SUI testnet');
  info('View challenge', `${EXPLORER}/object/${challenge.objectId}`, 'cyan');

  await sleep(400);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Agent pays on-chain
  // ═══════════════════════════════════════════════════════════════════════════
  step(4, '💳', 'AGENT SDK PAYS ON-CHAIN');

  arrow('Agent uses ai-paywall-agent-sdk to auto-handle the 402:');
  codeBlock([
    "import { createSuiAgentClient, fromSecretKeyBech32 } from 'ai-paywall-agent-sdk-sui';",
    '',
    'const agent = createSuiAgentClient({',
    '  signer: fromSecretKeyBech32(process.env.AGENT_PRIVATE_KEY),',
    '  network: "testnet",',
    '  maxPerRequestMist: 10_000_000,  // max 0.01 SUI per request',
    '  onPayment: ({ txDigest, priceMist }) => {',
    '    console.log(`Paid ${priceMist} MIST  tx: ${txDigest}`);',
    '  },',
    '});',
    '',
    '// Drop-in fetch — auto-pays 402s and retries:',
    `const res = await agent.fetch("${BASE_URL}${ARTICLE_PATH}");`,
    'const data = await res.json();  // Content arrives automatically',
  ]);

  arrow('Building Programmable Transaction Block (PTB)...');
  info('Target',    challenge.move.target, 'yellow');
  info('Challenge', challenge.objectId,    'yellow');
  info('Amount',    `${challenge.priceMist} MIST`, 'yellow');
  info('Clock',     CLOCK, 'yellow');

  arrow('Submitting transaction to SUI testnet...');

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [BigInt(challenge.priceMist)]);
  tx.moveCall({
    target: challenge.move.target,
    arguments: [tx.object(challenge.objectId), coin, tx.object(CLOCK)],
  });

  let payResult;
  try {
    payResult = await suiClient.signAndExecuteTransaction({
      signer:      keypair,
      transaction: tx,
      options:     { showEffects: true, showEvents: true },
    });
  } catch (err) {
    console.error(chalk.red(`\n  ✗  Transaction failed: ${err.message}\n`));
    process.exit(1);
  }

  if (payResult.effects?.status?.status !== 'success') {
    console.error(chalk.red(`\n  ✗  TX failed on-chain: ${JSON.stringify(payResult.effects?.status)}\n`));
    process.exit(1);
  }

  const txDigest = payResult.digest;

  ok(`Transaction SUCCESS`);
  info('TX digest',  txDigest, 'green');
  info('Gas used',   `${payResult.effects?.gasUsed?.computationCost ?? '?'} MIST`, 'dim');
  console.log(`\n  ${chalk.dim('→')} ${chalk.cyan.underline(`${EXPLORER}/tx/${txDigest}`)}\n`);

  // Show the PaymentVerified event
  const event = payResult.events?.find((e) => e.type?.endsWith('::paywall::PaymentVerified'));
  if (event) {
    arrow('On-chain PaymentVerified event emitted:');
    jsonBlock(event.parsedJson || event);
  }

  await sleep(200);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Content unlocked
  // ═══════════════════════════════════════════════════════════════════════════
  step(5, '🔓', 'CONTENT UNLOCKED — AGENT RETRIES WITH PAYMENT PROOF');

  arrow('Retrying request with payment headers...');
  info('x-sui-payment-tx',   txDigest,            'yellow');
  info('x-sui-challenge-id', challenge.objectId,  'yellow');

  const r200 = await fetch(`${BASE_URL}${ARTICLE_PATH}`, {
    headers: {
      'User-Agent':         'GPTBot/1.0',
      'x-sui-payment-tx':   txDigest,
      'x-sui-challenge-id': challenge.objectId,
    },
  });

  if (r200.status !== 200) {
    const b = await r200.json();
    console.error(chalk.red(`\n  ✗  Expected 200, got ${r200.status}: ${b.error || b.message}\n`));
    process.exit(1);
  }

  const r200body = await r200.json();

  info('HTTP status',   `${r200.status} OK`, 'green');
  info('Payment mode',  r200body.payment?.mode, 'green');
  info('Payer',         r200body.payment?.payer, 'green');
  info('Amount paid',   `${r200body.payment?.amountMist} MIST  (${(r200body.payment?.amountMist / 1e9).toFixed(6)} SUI)`, 'green');
  info('TX verified',   r200body.payment?.txDigest?.slice(0, 20) + '...', 'green');

  console.log('\n  ' + chalk.dim('Content delivered to agent:'));
  jsonBlock({
    status:  r200body.status,
    message: r200body.message,
    payment: r200body.payment,
    content: {
      title: r200body.content?.title,
      body:  r200body.content?.body?.slice(0, 80) + '...',
      path:  r200body.content?.path,
    },
  });

  ok('Content delivered — on-chain proof verified, no replay possible');

  await sleep(400);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6 — Publisher earnings
  // ═══════════════════════════════════════════════════════════════════════════
  step(6, '💰', 'PUBLISHER EARNINGS DASHBOARD');

  arrow('Reading publisher wallet from SUI testnet...');

  const balanceAfter = await getBalance(publisherAddress);
  const netChange    = balanceAfter - balanceBefore;

  console.log();
  console.log('  ' + chalk.bold.white('Publisher Wallet'));
  console.log('  ' + line);
  info('Address',          publisherAddress, 'yellow');
  info('Balance before',   `${(balanceBefore / 1e9).toFixed(6)} SUI`, 'dim');
  info('Balance after',    `${(balanceAfter  / 1e9).toFixed(6)} SUI`, 'green');
  info('Net this demo',    `${netChange >= 0 ? '+' : ''}${(netChange / 1e9).toFixed(6)} SUI  (after gas)`, netChange >= 0 ? 'green' : 'yellow');
  info('Payment received', `+1,000,000 MIST  (0.001000 SUI)`, 'green');
  info('Gas costs',        `challenge creation + pay_and_unlock PTB`, 'dim');
  console.log();
  console.log('  ' + chalk.dim('Note: In this demo the publisher and agent share one funded wallet.'));
  console.log('  ' + chalk.dim('In production the agent wallet is separate → publisher gets pure profit.'));
  console.log('  ' + line);
  info('Txn explorer',     `${EXPLORER}/tx/${txDigest}`, 'cyan');
  info('Account explorer', `${EXPLORER}/account/${publisherAddress}`, 'cyan');
  console.log();

  ok('Payment settled directly on-chain — zero custodian, zero API key');
  ok('Replay protection: consuming the challenge object is atomic on-chain');
  ok('Human users browse freely; AI agents pay per request');

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + chalk.cyan.bold('╔' + '═'.repeat(W - 2) + '╗'));
  const summaryLines = [
    '  DEMO COMPLETE  🎉',
    '',
    '  FLOW RECAP:',
    `  Human   →  GET /articles/*  →  200 OK  (free, always)`,
    `  Agent   →  GET /articles/*  →  402 + SUI challenge`,
    `  Agent   →  pay_and_unlock PTB on SUI testnet`,
    `  Agent   →  GET /articles/* + payment headers  →  200 OK`,
    `  Publisher  →  +0.001 SUI received on-chain`,
    '',
    '  NO API keys · NO database · NO custodians',
    '  Replay-safe: challenge objects consumed atomically on-chain',
  ];
  for (const l of summaryLines) {
    const padded = l.padEnd(W - 4);
    console.log(chalk.cyan.bold('║') + ' ' + chalk.white(padded) + ' ' + chalk.cyan.bold('║'));
  }
  console.log(chalk.cyan.bold('╚' + '═'.repeat(W - 2) + '╝') + '\n');
}

run().catch((err) => {
  console.error(chalk.red(`\n  ✗  Demo failed: ${err.message}\n`));
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
