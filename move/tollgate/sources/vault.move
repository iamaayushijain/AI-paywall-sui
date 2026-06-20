/// Tollgate revenue-splitting vault.
///
/// A publisher deploys ONE PublisherVault that encodes how incoming payments
/// are routed: publisher share, content-pool share, protocol fee — all in
/// basis points. When an AI agent pays with pay_and_unlock_split, the coin is
/// atomically split and transferred to all three destinations in a single PTB.
///
/// On-chain stats (total_received_mist, payment_count) accumulate in the vault
/// and are readable by anyone — no indexer needed for basic analytics.
module tollgate::vault {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use tollgate::paywall::{
        PaywallChallenge,
        challenge_price_mist,
        challenge_expires_at_ms,
        consume_challenge,
    };

    const E_INVALID_SPLIT: u64 = 0;
    const E_CHALLENGE_EXPIRED: u64 = 1;
    const E_INSUFFICIENT_PAYMENT: u64 = 2;
    const BASIS_POINTS: u64 = 10_000;

    /// Shared vault owned by the publisher.
    /// Stores split ratios and tracks cumulative payment stats on-chain.
    public struct PublisherVault has key {
        id: UID,
        publisher: address,
        publisher_bps: u64,      // e.g. 8000 = 80%
        pool_address: address,   // content pool / DAO / creator fund
        pool_bps: u64,           // e.g. 1500 = 15%
        protocol_address: address,
        protocol_bps: u64,       // e.g. 500 = 5%; must satisfy sum = 10000
        total_received_mist: u64,
        payment_count: u64,
    }

    /// Emitted on every split payment. Server reads this to confirm payment
    /// and agents can inspect the split breakdown.
    public struct SplitPaymentReceived has copy, drop {
        vault_id: address,
        challenge_id: address,
        payer: address,
        publisher: address,
        total_mist: u64,
        publisher_mist: u64,
        pool_mist: u64,
        protocol_mist: u64,
    }

    /// Publisher calls this once to register their payment routing config.
    /// The resulting shared vault ID is passed to pay_and_unlock_split.
    public entry fun create_vault(
        publisher_bps: u64,
        pool_address: address,
        pool_bps: u64,
        protocol_address: address,
        protocol_bps: u64,
        ctx: &mut TxContext,
    ) {
        assert!(publisher_bps + pool_bps + protocol_bps == BASIS_POINTS, E_INVALID_SPLIT);
        let vault = PublisherVault {
            id: object::new(ctx),
            publisher: ctx.sender(),
            publisher_bps,
            pool_address,
            pool_bps,
            protocol_address,
            protocol_bps,
            total_received_mist: 0,
            payment_count: 0,
        };
        transfer::share_object(vault);
    }

    /// Agent calls this to pay for content using split routing.
    /// In one atomic PTB:
    ///   1. Validates the challenge (not expired, price met).
    ///   2. Splits the coin into publisher / pool / protocol portions.
    ///   3. Transfers each portion to the correct address.
    ///   4. Consumes the challenge (replay protection, same as pay_and_unlock).
    ///   5. Updates vault cumulative stats.
    ///   6. Emits SplitPaymentReceived.
    public entry fun pay_and_unlock_split(
        challenge: PaywallChallenge,
        vault: &mut PublisherVault,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let current_ms = clock::timestamp_ms(clock);
        assert!(current_ms <= challenge_expires_at_ms(&challenge), E_CHALLENGE_EXPIRED);

        let amount = coin::value(&payment);
        let price = challenge_price_mist(&challenge);
        assert!(amount >= price, E_INSUFFICIENT_PAYMENT);

        // Return overpayment to sender before splitting
        if (amount > price) {
            let change = coin::split(&mut payment, amount - price, ctx);
            transfer::public_transfer(change, ctx.sender());
        };

        // Compute each portion; protocol gets the remainder to avoid rounding dust
        let publisher_amount = price * vault.publisher_bps / BASIS_POINTS;
        let pool_amount = price * vault.pool_bps / BASIS_POINTS;

        let publisher_coin = coin::split(&mut payment, publisher_amount, ctx);
        let pool_coin = coin::split(&mut payment, pool_amount, ctx);
        // `payment` now holds exactly the protocol portion (price - publisher_amount - pool_amount)
        let protocol_amount = coin::value(&payment);

        // Consume challenge — deletes the shared object (atomic replay protection)
        let (challenge_addr, publisher_addr, _price, _resource) = consume_challenge(challenge);

        // Atomic multi-destination transfer
        transfer::public_transfer(publisher_coin, vault.publisher);
        transfer::public_transfer(pool_coin, vault.pool_address);
        transfer::public_transfer(payment, vault.protocol_address);

        // Update on-chain stats
        vault.total_received_mist = vault.total_received_mist + price;
        vault.payment_count = vault.payment_count + 1;

        event::emit(SplitPaymentReceived {
            vault_id: object::uid_to_address(&vault.id),
            challenge_id: challenge_addr,
            payer: ctx.sender(),
            publisher: publisher_addr,
            total_mist: price,
            publisher_mist: publisher_amount,
            pool_mist: pool_amount,
            protocol_mist: protocol_amount,
        });
    }

    // ── Vault readers ──────────────────────────────────────────────────────────

    public fun vault_publisher(v: &PublisherVault): address { v.publisher }
    public fun vault_total_received(v: &PublisherVault): u64 { v.total_received_mist }
    public fun vault_payment_count(v: &PublisherVault): u64 { v.payment_count }
    public fun vault_splits(v: &PublisherVault): (u64, u64, u64) {
        (v.publisher_bps, v.pool_bps, v.protocol_bps)
    }
}
