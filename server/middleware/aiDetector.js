import dns from "dns/promises";
import { LRUCache } from "lru-cache"; // npm i lru-cache

// ─── 1. KNOWN BOT USER-AGENT PATTERNS ────────────────────────────────────────
// Covers crawlers, AI scrapers, headless browsers, and generic bot UAs.
const BOT_UA_PATTERNS = [
  // AI / LLM crawlers
  { pattern: /GPTBot/i,           name: "GPTBot",        score: 90 },
  { pattern: /ClaudeBot/i,        name: "ClaudeBot",     score: 90 },
  { pattern: /PerplexityBot/i,    name: "PerplexityBot", score: 90 },
  { pattern: /ChatGPT-User/i,     name: "ChatGPT",       score: 90 },
  { pattern: /OAI-SearchBot/i,    name: "OAI-SearchBot", score: 90 },
  { pattern: /Anthropic/i,        name: "Anthropic",     score: 85 },
  { pattern: /CCBot/i,            name: "CCBot",         score: 85 },
  { pattern: /YouBot/i,           name: "YouBot",        score: 85 },
  { pattern: /Bytespider/i,       name: "Bytespider",    score: 85 }, // ByteDance/TikTok
  { pattern: /Applebot/i,         name: "Applebot",      score: 80 },
  { pattern: /cohere-ai/i,        name: "CohereBot",     score: 85 },
  { pattern: /meta-externalagent/i, name: "MetaAI",      score: 85 },
  { pattern: /Diffbot/i,          name: "Diffbot",       score: 80 },
  { pattern: /Omgilibot/i,        name: "Omgili",        score: 80 },
  { pattern: /DataForSeoBot/i,    name: "DataForSeo",    score: 75 },

  // Classic search crawlers (lower score — legitimate but still bots)
  { pattern: /Googlebot/i,        name: "Googlebot",     score: 70 },
  { pattern: /bingbot/i,          name: "Bingbot",       score: 70 },
  { pattern: /Slurp/i,            name: "Yahoo",         score: 70 },
  { pattern: /DuckDuckBot/i,      name: "DuckDuckBot",   score: 70 },
  { pattern: /Baiduspider/i,      name: "Baidu",         score: 70 },

  // Headless / automation
  { pattern: /HeadlessChrome/i,   name: "Headless",      score: 75 },
  { pattern: /PhantomJS/i,        name: "PhantomJS",     score: 80 },
  { pattern: /Selenium/i,         name: "Selenium",      score: 80 },
  { pattern: /Playwright/i,       name: "Playwright",    score: 80 },
  { pattern: /Puppeteer/i,        name: "Puppeteer",     score: 80 },

  // Generic scraper signals in UA
  { pattern: /python-requests/i,  name: "PythonRequests",score: 70 },
  { pattern: /axios/i,            name: "Axios",         score: 55 },
  { pattern: /curl/i,             name: "curl",          score: 55 },
  { pattern: /wget/i,             name: "wget",          score: 65 },
  { pattern: /go-http-client/i,   name: "GoHTTP",        score: 60 },
  { pattern: /java\//i,           name: "JavaHTTP",      score: 55 },
  { pattern: /libwww-perl/i,      name: "Perl",          score: 65 },
  { pattern: /scrapy/i,           name: "Scrapy",        score: 85 },
];

// ─── 2. DATACENTER / CLOUD CIDR RANGES ───────────────────────────────────────
// Real users don't typically browse from AWS/GCP/Azure egress IPs.
// Keep this list updated; ideally replace with a maintained npm package
// like `geoip-lite` + ASN database, or the `ipdata` / `ipinfo` API.
const DATACENTER_CIDRS = [
  "3.0.0.0/8",       // AWS
  "13.0.0.0/8",      // AWS
  "18.0.0.0/8",      // AWS
  "34.0.0.0/8",      // GCP
  "35.0.0.0/8",      // GCP
  "104.154.0.0/15",  // GCP
  "20.0.0.0/8",      // Azure
  "40.0.0.0/8",      // Azure
  "51.0.0.0/8",      // Azure
  "104.16.0.0/12",   // Cloudflare Workers
  "162.158.0.0/15",  // Cloudflare
  "198.41.128.0/17", // Cloudflare
];

// Pre-compute for fast lookup
const parsedCidrs = DATACENTER_CIDRS.map((cidr) => {
  const [ip, bits] = cidr.split("/");
  const mask = ~((1 << (32 - parseInt(bits))) - 1) >>> 0;
  const base = ipToInt(ip) & mask;
  return { base, mask };
});

function ipToInt(ip) {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
}

function isDatacenterIP(ip) {
  try {
    const n = ipToInt(ip);
    return parsedCidrs.some(({ base, mask }) => (n & mask) === base);
  } catch {
    return false;
  }
}

// ─── 3. HEADER FINGERPRINTING ─────────────────────────────────────────────────
// Real browsers always send these. Bots and scripts usually omit them.
const BROWSER_HEADERS = [
  "accept-language",     // Always present in real browsers
  "accept-encoding",     // Always present
  "sec-fetch-site",      // Present in Chrome/Firefox for navigations
  "sec-ch-ua",           // Chrome client hints
];

function headerScore(headers) {
  let score = 0;
  const missing = BROWSER_HEADERS.filter((h) => !headers[h]);

  // Each missing browser header adds suspicion
  score += missing.length * 12;

  // No Accept header at all is extremely suspicious
  if (!headers["accept"]) score += 20;

  // Bots often send bare Accept: */* — browsers never do for HTML requests
  if (headers["accept"] === "*/*") score += 15;

  // Connection: keep-alive is universal in browsers but often missing in scripts
  if (!headers["connection"]) score += 10;

  return score;
}

// ─── 4. REVERSE DNS VERIFICATION ─────────────────────────────────────────────
// Legitimate bots (Googlebot, ClaudeBot) resolve their IPs back to
// known hostnames. Spoofed UAs won't pass reverse DNS.
const dnsCache = new LRUCache({ max: 2000, ttl: 1000 * 60 * 60 }); // 1hr TTL

const LEGITIMATE_BOT_HOSTNAMES = [
  /googlebot\.com$/,
  /google\.com$/,
  /crawl\.yahoo\.net$/,
  /search\.msn\.com$/,
  /anthropic\.com$/,
  /openai\.com$/,
];

async function reverseDnsLookup(ip) {
  if (dnsCache.has(ip)) return dnsCache.get(ip);
  try {
    const hostnames = await dns.reverse(ip);
    const result = hostnames[0] ?? null;
    dnsCache.set(ip, result);
    return result;
  } catch {
    dnsCache.set(ip, null);
    return null;
  }
}

async function isVerifiedLegitBot(ip, uaName) {
  if (!uaName) return false;
  const hostname = await reverseDnsLookup(ip);
  if (!hostname) return false;
  return LEGITIMATE_BOT_HOSTNAMES.some((pattern) => pattern.test(hostname));
}

// ─── 5. COMPOSITE SCORING MIDDLEWARE ─────────────────────────────────────────

export async function aiDetector(req, res, next) {
  const ua = req.headers["user-agent"] ?? "";
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket?.remoteAddress ??
    "";

  let totalScore = 0;
  let detectedName = null;
  const signals = [];

  // — Signal A: User-Agent pattern match
  const uaMatch = BOT_UA_PATTERNS.find(({ pattern }) => pattern.test(ua));
  if (uaMatch) {
    totalScore += uaMatch.score;
    detectedName = uaMatch.name;
    signals.push(`ua:${uaMatch.name}(${uaMatch.score})`);
  }

  // Missing UA entirely is a strong signal
  if (!ua) {
    totalScore += 60;
    signals.push("ua:missing(60)");
  }

  // — Signal B: Header fingerprint analysis
  const hScore = headerScore(req.headers);
  if (hScore > 0) {
    totalScore += hScore;
    signals.push(`headers:suspicious(${hScore})`);
  }

  // — Signal C: Datacenter IP
  if (ip && isDatacenterIP(ip)) {
    totalScore += 30;
    signals.push("ip:datacenter(30)");
  }

  // — Signal D: Reverse DNS verification (async, non-blocking for speed)
  //   Only run if UA already looks like a bot to avoid latency on real users.
  //   Mark verified bots separately — they're legitimate crawlers, not scrapers.
  let isVerifiedBot = false;
  if (uaMatch && uaMatch.score >= 70) {
    isVerifiedBot = await isVerifiedLegitBot(ip, detectedName);
    if (isVerifiedBot) signals.push("rdns:verified");
  }

  // — Signal E: Empty or minimal Accept header for an HTML route
  const acceptHtml = req.headers["accept"]?.includes("text/html");
  if (!acceptHtml && req.method === "GET") {
    totalScore += 15;
    signals.push("accept:no-html(15)");
  }

  // ── Final classification ──────────────────────────────────────────────────
  // Thresholds:
  //   >= 70  → high confidence bot
  //   40–69  → suspicious / possible bot
  //   < 40   → likely human

  req.botDetection = {
    isBot: totalScore >= 70,
    isSuspicious: totalScore >= 40 && totalScore < 70,
    isVerifiedLegitimateBot: isVerifiedBot,    // e.g. real Googlebot — may want to allow
    score: totalScore,
    botName: detectedName,
    signals,
    ip,
  };

  // Convenience aliases
  req.isAI = req.botDetection.isBot;
  req.botName = req.botDetection.botName;

  next();
}