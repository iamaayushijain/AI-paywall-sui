const BOT_PURPOSE = {
  GPTBot:          { type: "general_llm",   affinity: 8 },
  ClaudeBot:       { type: "general_llm",   affinity: 8 },
  PerplexityBot:   { type: "search_answer", affinity: 7 },
  GoogleBot:       { type: "search_index",  affinity: 4 },
  CodeInterpreter: { type: "code",          affinity: 9 },
  CCBot:           { type: "training_data", affinity: 10 },
  unknown:         { type: "unknown",       affinity: 5 },
};

function stripHTML(text) {
  return text.replace(/<[^>]*>/g, "");
}

function getWordCount(text) {
  if (!text) return 0;
  return stripHTML(text).split(/\s+/).filter(Boolean).length;
}

function getDensityScore(wordCount) {
  if (wordCount < 100) return 2;
  if (wordCount <= 500) return 4;
  if (wordCount <= 1500) return 6;
  if (wordCount <= 3000) return 8;
  return 10;
}

function getPathType(reqPath) {
  if (reqPath === "/") return "index";
  if (/^\/(blog|articles)(\/|$)/i.test(reqPath)) return "editorial";
  if (/^\/(docs|api)(\/|$)/i.test(reqPath)) return "technical";
  if (/^\/(data|research)(\/|$)/i.test(reqPath)) return "dataset";
  return "general";
}

function getPathBonus(botType, reqPath) {
  if (botType === "training_data") return 3;
  if (botType === "search_answer") return 1;
  if (botType === "general_llm" && /^\/(blog|articles)(\/|$)/i.test(reqPath)) return 2;
  if (botType === "code" && /^\/(docs|api)(\/|$)/i.test(reqPath)) return 2;
  return 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function scoreRelevance(botName, path, contentBody) {
  const bot = BOT_PURPOSE[botName] || BOT_PURPOSE.unknown;
  const wordCount = getWordCount(contentBody);
  const density = getDensityScore(wordCount);
  const bonus = getPathBonus(bot.type, path);
  const raw = (bot.affinity * 0.4) + (density * 0.35) + (bonus * 0.25);
  return Math.round(clamp(raw, 1, 10));
}

export function getContentSignals(botName, path, contentBody) {
  const bot = BOT_PURPOSE[botName] || BOT_PURPOSE.unknown;
  return {
    bot_tier: bot.affinity,
    path_type: getPathType(path),
    estimated_word_count: contentBody ? getWordCount(contentBody) : null,
  };
}

export function getPriceForRequest(botName, path, contentBody, baseLamports) {
  const score = scoreRelevance(botName, path, contentBody);
  return Math.floor(baseLamports * score);
}
