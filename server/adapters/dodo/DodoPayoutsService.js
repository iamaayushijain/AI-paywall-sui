/**
 * DodoPayoutsService
 *
 * Thin wrapper around Dodo's Payouts API.
 *
 * Note: Dodo manages payouts automatically on a schedule — there is no
 * "create payout" API endpoint. This service provides read access to payout
 * history and per-publisher revenue data derived from dodo_usage_events.
 *
 * For publishers who need manual payouts, use the Dodo dashboard or contact
 * their support to configure a payout schedule.
 */

import DodoPayments from "dodopayments";
import db from "../../data/db.js";

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_ENV     = process.env.DODO_ENVIRONMENT || "test_mode";

function getDodoClient() {
  if (!DODO_API_KEY) throw new Error("DODO_PAYMENTS_API_KEY is not set");
  return new DodoPayments({ bearerToken: DODO_API_KEY, environment: DODO_ENV });
}

export class DodoPayoutsService {
  /**
   * List recent payouts from Dodo.
   * These are platform-level payouts, not per-publisher.
   *
   * @returns {Array} payout records from Dodo
   */
  async listPayouts() {
    const client = getDodoClient();
    // Dodo returns an iterable/page of payout objects.
    const page = await client.payouts.list();
    const results = [];
    for await (const payout of page) {
      results.push({
        payoutId:      payout.payout_id,
        amount:        payout.amount,
        currency:      payout.currency,
        status:        payout.status,
        paymentMethod: payout.payment_method,
        createdAt:     payout.created_at,
        updatedAt:     payout.updated_at,
      });
    }
    return results;
  }

  /**
   * Get revenue summary for a specific publisher from our usage events.
   * This is our own accounting, not Dodo's — Dodo doesn't have per-publisher splits.
   *
   * @param {string} publisherId
   * @returns {{ totalUsd: number, eventCount: number, lastPaidAt: string|null }}
   */
  async getPublisherBalance(publisherId) {
    const { data, error } = await db
      .from("dodo_usage_events")
      .select("amount_usd, created_at")
      .eq("publisher_id", publisherId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch publisher balance: ${error.message}`);

    const events = data || [];
    const totalUsd = events.reduce((sum, row) => sum + Number(row.amount_usd || 0), 0);

    return {
      publisherId,
      totalUsd: Math.round(totalUsd * 10000) / 10000,
      eventCount: events.length,
      lastPaidAt: events[0]?.created_at || null,
    };
  }

  /**
   * List usage events for a publisher.
   * Called by the dashboard to show revenue breakdown.
   *
   * @param {string} publisherId
   * @param {number} [limit=50]
   * @returns {Array}
   */
  async getPublisherEvents(publisherId, limit = 50) {
    const { data, error } = await db
      .from("dodo_usage_events")
      .select("*")
      .eq("publisher_id", publisherId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch events: ${error.message}`);
    return data || [];
  }
}

export default new DodoPayoutsService();
