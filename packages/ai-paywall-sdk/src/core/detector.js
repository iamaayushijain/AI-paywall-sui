const BOT_PATTERNS = [
  /GPTBot/i, /ChatGPT-User/i, /ClaudeBot/i, /anthropic-ai/i,
  /PerplexityBot/i, /CCBot/i, /Googlebot/i, /bingbot/i,
  /Applebot/i, /Bytespider/i, /DiffbotCrawler/i,
  /FacebookBot/i, /facebookexternalhit/i, /LinkedInBot/i,
  /python-requests/i, /python-httpx/i, /Go-http-client/i,
  /Scrapy/i, /curl\/\d/i, /wget\/\d/i,
  /axios\/\d/i, /node-fetch/i, /undici/i,
];

export function detectBot(req) {
  const ua = req.headers?.['user-agent'] || '';
  return BOT_PATTERNS.some((p) => p.test(ua));
}
