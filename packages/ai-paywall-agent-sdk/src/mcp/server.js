#!/usr/bin/env node
/**
 * Tollgate MCP Server — Dodo Payments
 *
 * An MCP server that gives LLMs (Claude, GPT-4, etc.) the ability to access
 * Tollgate-gated content by paying automatically via Dodo Payments.
 *
 * The LLM never sees payment details — it just calls fetch_tollgate_content(url)
 * and gets the content back. Everything else is handled here.
 *
 * Setup (Claude Desktop):
 *   claude mcp add tollgate -- node /path/to/this/server.js
 *
 * Setup (Claude Code):
 *   claude mcp add tollgate \
 *     --env DODO_AGENT_API_KEY="..." \
 *     --env DODO_AGENT_PAYMENT_METHOD_ID="pm_..." \
 *     -- node /path/to/packages/ai-paywall-agent-sdk/src/mcp/server.js
 *
 * Required env vars:
 *   DODO_AGENT_API_KEY           — agent's Dodo API key (from Dodo dashboard)
 *   DODO_AGENT_PAYMENT_METHOD_ID — pre-saved payment method ID (pm_xxx)
 *
 * Optional env vars:
 *   MAX_PRICE_USD        — hard cap per request, default 0.10
 *   POLL_INTERVAL_MS     — webhook poll interval, default 3000
 *   POLL_TIMEOUT_MS      — max wait for payment confirmation, default 60000
 *   AGENT_USER_AGENT     — UA string sent with requests, default TollgateAgent/1.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// ── Config ────────────────────────────────────────────────────────────────────
const DODO_AGENT_API_KEY          = process.env.DODO_AGENT_API_KEY;
const DODO_AGENT_PAYMENT_METHOD_ID = process.env.DODO_AGENT_PAYMENT_METHOD_ID;
const MAX_PRICE_USD    = parseFloat(process.env.MAX_PRICE_USD    || "0.10");
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS   || "3000",  10);
const POLL_TIMEOUT_MS  = parseInt(process.env.POLL_TIMEOUT_MS    || "60000", 10);
const AGENT_UA         = process.env.AGENT_USER_AGENT || "TollgateAgent/1.0";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Poll /v1/dodo/session/:id/status until paid or timeout.
 * Returns the facilitator base URL extracted from the 402 response.
 */
async function pollUntilPaid(facilitatorBase, sessionId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await fetch(`${facilitatorBase}/v1/dodo/session/${sessionId}/status`);
    if (!r.ok) throw new Error(`Status poll failed: ${r.status}`);
    const { status } = await r.json();
    if (status === "paid")    return;
    if (status === "expired") throw new Error("Payment session expired before confirmation");
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Payment not confirmed within ${POLL_TIMEOUT_MS / 1000}s`);
}

/**
 * Fetch a JWT content token once the session is paid.
 */
async function fetchToken(facilitatorBase, sessionId) {
  const r = await fetch(`${facilitatorBase}/v1/dodo/session/${sessionId}/token`);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(`Token fetch failed (${r.status}): ${body.error || r.statusText}`);
  }
  const { token } = await r.json();
  return token;
}

/**
 * Extract facilitator base URL from the payment_url.
 * payment_url is a Dodo checkout URL — the facilitator base comes from the 402 body.
 */
function extractFacilitatorBase(paymentRequiredHeader) {
  // The 402 body contains instructions like "Poll GET https://facilitator/v1/dodo/session/..."
  // We pass the full 402 body so we can extract it properly.
  // Fallback: caller passes it explicitly.
  return null;
}

// ── Core payment flow ─────────────────────────────────────────────────────────

/**
 * Fetch a Tollgate-protected URL, paying automatically with Dodo if needed.
 *
 * @param {string} url            The URL to fetch
 * @param {number} maxPriceUsd    Per-request price cap (defaults to MAX_PRICE_USD env)
 * @returns {{ content: any, paid: boolean, sessionId?: string, amountUsd?: number }}
 */
async function fetchWithDodoPayment(url, maxPriceUsd = MAX_PRICE_USD) {
  const headers = { "User-Agent": AGENT_UA };

  // If agent has a payment method, pass it so the server auto-confirms without browser.
  if (DODO_AGENT_PAYMENT_METHOD_ID) {
    headers["x-dodo-payment-method"] = DODO_AGENT_PAYMENT_METHOD_ID;
  }

  // ── Initial request ────────────────────────────────────────────────────────
  const r1 = await fetch(url, { headers });

  if (r1.ok) {
    const body = await r1.json().catch(() => r1.text());
    return { content: body, paid: false };
  }

  if (r1.status !== 402) {
    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected status ${r1.status} from ${url}`
    );
  }

  // ── Parse 402 envelope ────────────────────────────────────────────────────
  const envelope = await r1.json();

  if (envelope.adapter !== "dodo") {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `This MCP server only handles Dodo-adapter paywalls. Got adapter: "${envelope.adapter || "solana"}"`
    );
  }

  const priceUsd  = parseFloat(envelope.amount || 0.01);
  const sessionId = envelope.session_id;
  const paymentUrl = envelope.payment_url;

  if (!sessionId) {
    throw new McpError(ErrorCode.InternalError, "402 response missing session_id");
  }

  // ── Price guard ────────────────────────────────────────────────────────────
  if (priceUsd > maxPriceUsd) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Content costs $${priceUsd} USD which exceeds your limit of $${maxPriceUsd}. ` +
      `Pass max_price_usd=${priceUsd} to allow this payment.`
    );
  }

  // ── Derive facilitator base from the instructions in the 402 body ──────────
  // Instructions contain a URL like: "Poll GET https://facilitator/v1/dodo/session/..."
  let facilitatorBase = "";
  if (Array.isArray(envelope.instructions)) {
    const pollLine = envelope.instructions.find((l) => l.includes("/v1/dodo/session/"));
    if (pollLine) {
      const match = pollLine.match(/(https?:\/\/[^/]+)/);
      if (match) facilitatorBase = match[1];
    }
  }
  if (!facilitatorBase) {
    // Fall back: derive from the URL the agent is hitting (same host = publisher+facilitator)
    const parsed = new URL(url);
    facilitatorBase = parsed.origin;
  }

  // ── If payment_method_id was sent, Dodo auto-confirms — just poll ──────────
  // ── Otherwise surface the payment URL so a human or tool can pay ──────────
  if (!DODO_AGENT_PAYMENT_METHOD_ID) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `No DODO_AGENT_PAYMENT_METHOD_ID configured. ` +
      `Manual payment required — open this URL: ${paymentUrl} ` +
      `Then retry after payment is confirmed.`
    );
  }

  // ── Poll until webhook confirms payment ────────────────────────────────────
  await pollUntilPaid(facilitatorBase, sessionId);

  // ── Get content token ──────────────────────────────────────────────────────
  const token = await fetchToken(facilitatorBase, sessionId);

  // ── Retry with token ───────────────────────────────────────────────────────
  const r2 = await fetch(url, {
    headers: {
      "User-Agent": AGENT_UA,
      "x-tollgate-token": token,
    },
  });

  if (!r2.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      `Content request failed after payment (${r2.status})`
    );
  }

  const content = await r2.json().catch(() => r2.text());
  return {
    content,
    paid: true,
    sessionId,
    amountUsd: priceUsd,
    token,
  };
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "tollgate", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fetch_tollgate_content",
      description:
        "Fetch content from a URL that may be protected by Tollgate's HTTP 402 paywall. " +
        "If the URL returns 402, automatically pays via Dodo Payments and retries. " +
        "If the URL is free (200), returns it immediately. " +
        "Use this instead of a regular fetch/browser tool when accessing AI-gated content.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL to fetch (e.g. https://publisher.com/articles/ai-trends)",
          },
          max_price_usd: {
            type: "number",
            description: `Maximum price you're willing to pay in USD. Default: ${MAX_PRICE_USD}`,
          },
        },
        required: ["url"],
      },
    },
    {
      name: "check_tollgate_session",
      description:
        "Check the status of a Tollgate payment session. " +
        "Returns 'pending', 'paid', or 'expired'.",
      inputSchema: {
        type: "object",
        properties: {
          facilitator_url: {
            type: "string",
            description: "Base URL of the Tollgate facilitator server",
          },
          session_id: {
            type: "string",
            description: "Session ID from a previous 402 response",
          },
        },
        required: ["facilitator_url", "session_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "fetch_tollgate_content") {
    const { url, max_price_usd } = args;
    if (!url || typeof url !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "url is required");
    }

    const result = await fetchWithDodoPayment(url, max_price_usd);

    const lines = [];
    if (result.paid) {
      lines.push(`✓ Paid $${result.amountUsd} USD via Dodo Payments`);
      lines.push(`  Session: ${result.sessionId}`);
      lines.push("");
    }
    lines.push(
      typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content, null, 2)
    );

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }

  if (name === "check_tollgate_session") {
    const { facilitator_url, session_id } = args;
    const r = await fetch(`${facilitator_url}/v1/dodo/session/${session_id}/status`);
    const body = await r.json();
    return {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[tollgate-mcp] Server running — waiting for tool calls");
