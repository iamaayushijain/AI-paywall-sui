import 'dotenv/config';
import { createSuiAgentClient, fromSecretKeyBech32 } from 'ai-paywall-agent-sdk-sui';

const BLOG_URL = 'http://localhost:4000';

// ── Agent wallet setup ────────────────────────────────────────────────────────
const agent = createSuiAgentClient({
  signer:             fromSecretKeyBech32(process.env.AGENT_PRIVATE_KEY),
  network:            'testnet',
  maxPerRequestMist:  5_000_000,    // refuse to pay more than 0.005 SUI per request
  maxTotalMist:       50_000_000,   // session budget: 0.05 SUI total
  onPayment: ({ txDigest, priceMist, challengeObjectId }) => {
    console.log('\n  ✓ Payment sent on-chain!');
    console.log(`    Paid:      ${priceMist} MIST  (${priceMist / 1e9} SUI)`);
    console.log(`    TX:        ${txDigest}`);
    console.log(`    Challenge: ${challengeObjectId}`);
    console.log(`    Explorer:  https://suiscan.xyz/testnet/tx/${txDigest}\n`);
  },
});

async function main() {
  console.log('\n  Agent address:', agent.address());
  console.log('  Session budget: 50,000,000 MIST (0.05 SUI)\n');

  // ── Fetch article — SDK handles the 402 automatically ────────────────────
  console.log('  Fetching: GET', `${BLOG_URL}/articles/rise-of-ai-agents`);
  console.log('  (If blocked with 402, the SDK will auto-pay and retry)\n');

  const res  = await agent.fetch(`${BLOG_URL}/articles/rise-of-ai-agents`, {
    headers: { 'User-Agent': 'GPTBot/1.0' },
  });
  const data = await res.json();

  console.log('  ✓ Got article:', data.title);
  console.log('  ✓ Accessed as:', data.accessedAs);
  console.log('\n  --- Article body ---');
  console.log(data.body);
  console.log('  -------------------');
  console.log(`\n  Total spent this session: ${agent.spend()} MIST  (${agent.spend() / 1e9} SUI)\n`);
}

main().catch((err) => {
  console.error('\n  Error:', err.message, '\n');
  process.exit(1);
});
