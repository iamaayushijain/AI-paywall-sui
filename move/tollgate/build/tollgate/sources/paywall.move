/// Tollgate paywall — trustless on-chain facilitator.
///
/// Flow:
///   1. Server calls create_challenge() → shared PaywallChallenge object.
///   2. Server returns the object ID to the AI agent in the HTTP 402 body.
///   3. Agent builds a PTB: pay_and_unlock(challenge, coin, clock).
///   4. Consuming the challenge object is atomic on-chain replay protection —
///      a second attempt with the same object ID fails because the object is gone.
///   5. Server reads the PaymentVerified event from the tx to confirm payment.
///
/// The vault module (tollgate::vault) also uses this module for split payments.
/// It calls consume_challenge() to destruct the challenge and emit its own event.
module tollgate::paywall {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::{Self, String};

    const E_CHALLENGE_EXPIRED: u64 = 0;
    const E_INSUFFICIENT_PAYMENT: u64 = 1;

    /// On-chain challenge created per-request by the publisher server.
    /// Shared so any agent can read and consume it.
    public struct PaywallChallenge has key {
        id: UID,
        resource: String,
        publisher: address,
        price_mist: u64,
        expires_at_ms: u64,
    }

    /// Emitted by pay_and_unlock. The server reads this event to confirm payment.
    public struct PaymentVerified has copy, drop {
        challenge_id: address,
        payer: address,
        publisher: address,
        resource: String,
        amount_mist: u64,
    }

    /// Publisher server calls this to issue an on-chain challenge.
    /// The resulting shared object ID is included in the HTTP 402 response.
    public entry fun create_challenge(
        resource: vector<u8>,
        publisher: address,
        price_mist: u64,
        expires_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        let challenge = PaywallChallenge {
            id: object::new(ctx),
            resource: string::utf8(resource),
            publisher,
            price_mist,
            expires_at_ms,
        };
        transfer::share_object(challenge);
    }

    /// Agent calls this to pay and unlock content (simple direct payment).
    /// Consumes the challenge object — intrinsic replay protection.
    /// Returns excess SUI to the sender if overpaid.
    public entry fun pay_and_unlock(
        challenge: PaywallChallenge,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let current_ms = clock::timestamp_ms(clock);
        assert!(current_ms <= challenge.expires_at_ms, E_CHALLENGE_EXPIRED);

        let amount = coin::value(&payment);
        assert!(amount >= challenge.price_mist, E_INSUFFICIENT_PAYMENT);

        let PaywallChallenge { id, resource, publisher, price_mist, expires_at_ms: _ } = challenge;
        let challenge_id = object::uid_to_address(&id);

        if (amount > price_mist) {
            let change = coin::split(&mut payment, amount - price_mist, ctx);
            transfer::public_transfer(change, ctx.sender());
        };

        event::emit(PaymentVerified {
            challenge_id,
            payer: ctx.sender(),
            publisher,
            resource,
            amount_mist: price_mist,
        });

        object::delete(id);
        transfer::public_transfer(payment, publisher);
    }

    // ── Public accessors — used by tollgate::vault ─────────────────────────────

    public fun challenge_price_mist(c: &PaywallChallenge): u64 { c.price_mist }
    public fun challenge_expires_at_ms(c: &PaywallChallenge): u64 { c.expires_at_ms }
    public fun challenge_publisher(c: &PaywallChallenge): address { c.publisher }
    public fun challenge_resource(c: &PaywallChallenge): String { c.resource }

    /// Destructs and deletes the challenge, returning its key fields to the caller.
    /// Called by vault::pay_and_unlock_split — the vault module handles validation
    /// and emits its own SplitPaymentReceived event instead of PaymentVerified.
    public fun consume_challenge(
        challenge: PaywallChallenge,
    ): (address, address, u64, String) {
        let PaywallChallenge { id, resource, publisher, price_mist, expires_at_ms: _ } = challenge;
        let challenge_addr = object::uid_to_address(&id);
        object::delete(id);
        (challenge_addr, publisher, price_mist, resource)
    }
}
