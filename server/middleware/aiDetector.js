// middleware to detect if the request is from an AI bot


const AI_BOT_PATTERNS = [
  /GPTBot/i,
  /ClaudeBot/i,
  /PerplexityBot/i,
  /ChatGPT/i,
  /Anthropic/i,
  /CCBot/i,
];

export function aiDetector(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  req.isAI = AI_BOT_PATTERNS.some((pattern) => pattern.test(ua));
  req.botName = req.isAI
    ? (ua.match(/GPTBot|ClaudeBot|PerplexityBot|ChatGPT|Anthropic|CCBot/i)?.[0] ?? "UnknownBot")
    : null;
  next();
}
