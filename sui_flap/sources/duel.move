module sui_flap::duel;

use std::option::{Self as std_option, Option};
use sui::balance::{Self as sui_balance};
use sui::clock::{Self as sui_clock, Clock};
use sui::coin::{Self as sui_coin, Coin};
use sui::event;
use sui::object::{Self as sui_object, ID, UID};
use sui::sui::SUI;
use sui::transfer::{Self as sui_transfer};
use sui::tx_context::{Self as sui_tx_context, TxContext};

use sui_flap::tax_vault::{Self, TaxVault};
use sui_flap::token_curve::{Self, LaunchToken, TokenCurve};

const STATUS_ONGOING: u8 = 1;
const STATUS_FINISHED: u8 = 2;

const EArenaAdminOnly: u64 = 0;
const EDuelNotFound: u64 = 1;
const EDuelNotOpen: u64 = 2;
const ECurveNotInDuel: u64 = 3;

public struct DuelArena has key {
    id: UID,
    admin: address,
    next_duel_id: u64,
    active_duels: vector<DuelPair>,
}

public struct DuelPair has store {
    duel_id: u64,
    token_a: ID,
    token_b: ID,
    start_time: u64,
    end_time: u64,
    volume_a: u64,
    volume_b: u64,
    status: u8,
    winner: Option<ID>,
    loser: Option<ID>,
}

public struct ArenaCreated has copy, drop {
    arena_id: ID,
    admin: address,
}

public struct DuelCreated has copy, drop {
    arena_id: ID,
    duel_id: u64,
    token_a: ID,
    token_b: ID,
    start_time: u64,
    end_time: u64,
}

public struct DuelTrade has copy, drop {
    arena_id: ID,
    duel_id: u64,
    token_id: ID,
    gross_sui_in: u64,
    at_ms: u64,
}

public struct DuelResolved has copy, drop {
    arena_id: ID,
    duel_id: u64,
    winner: Option<ID>,
    loser: Option<ID>,
    volume_a: u64,
    volume_b: u64,
    at_ms: u64,
}

public struct LiquidityMigrated has copy, drop {
    arena_id: ID,
    duel_id: u64,
    winner_curve_id: ID,
    loser_curve_id: ID,
    migrated_sui: u64,
    winner_tokens_bought: u64,
    dust_to_winner: u64,
    winner_creator: address,
    at_ms: u64,
}

public fun create_arena(ctx: &mut TxContext): DuelArena {
    let arena = DuelArena {
        id: sui_object::new(ctx),
        admin: sui_tx_context::sender(ctx),
        next_duel_id: 0,
        active_duels: vector[],
    };

    event::emit(ArenaCreated {
        arena_id: sui_object::id(&arena),
        admin: arena.admin,
    });

    arena
}

public fun share_arena(arena: DuelArena) {
    sui_transfer::share_object(arena);
}

public fun enter_duel(
    arena: &mut DuelArena,
    curve_a: &TokenCurve,
    curve_b: &TokenCurve,
    clock: &Clock,
    duration_ms: u64,
    ctx: &TxContext,
) {
    assert!(arena.admin == sui_tx_context::sender(ctx), EArenaAdminOnly);

    let duel_id = arena.next_duel_id;
    arena.next_duel_id = duel_id + 1;

    let pair = DuelPair {
        duel_id,
        token_a: token_curve::curve_id(curve_a),
        token_b: token_curve::curve_id(curve_b),
        start_time: sui_clock::timestamp_ms(clock),
        end_time: sui_clock::timestamp_ms(clock) + duration_ms,
        volume_a: 0,
        volume_b: 0,
        status: STATUS_ONGOING,
        winner: std_option::none<ID>(),
        loser: std_option::none<ID>(),
    };

    vector::push_back(&mut arena.active_duels, pair);

    event::emit(DuelCreated {
        arena_id: sui_object::id(arena),
        duel_id,
        token_a: token_curve::curve_id(curve_a),
        token_b: token_curve::curve_id(curve_b),
        start_time: sui_clock::timestamp_ms(clock),
        end_time: sui_clock::timestamp_ms(clock) + duration_ms,
    });
}

public fun buy_in_duel(
    arena: &mut DuelArena,
    duel_id: u64,
    curve: &mut TokenCurve,
    vault: &mut TaxVault,
    token: &mut LaunchToken,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    let arena_id = sui_object::id(arena);
    let idx = find_duel_index(&arena.active_duels, duel_id);
    let token_id = token_curve::curve_id(curve);
    let now = sui_clock::timestamp_ms(clock);

    {
        let pair = vector::borrow(&arena.active_duels, idx);
        assert!(pair.status == STATUS_ONGOING, EDuelNotOpen);
        assert!(now >= pair.start_time && now <= pair.end_time, EDuelNotOpen);
        assert!(token_id == pair.token_a || token_id == pair.token_b, ECurveNotInDuel);
    };

    let gross_sui_in = sui_coin::value(&payment);
    let change = tax_vault::taxed_buy_into_token(curve, vault, token, payment, clock, ctx);

    {
        let pair = vector::borrow_mut(&mut arena.active_duels, idx);
        if (token_id == pair.token_a) {
            pair.volume_a = pair.volume_a + gross_sui_in;
        } else {
            pair.volume_b = pair.volume_b + gross_sui_in;
        };
    };

    event::emit(DuelTrade {
        arena_id,
        duel_id,
        token_id,
        gross_sui_in,
        at_ms: now,
    });

    change
}

public fun resolve_duel(
    arena: &mut DuelArena,
    duel_id: u64,
    curve_a: &mut TokenCurve,
    vault_a: &mut TaxVault,
    curve_b: &mut TokenCurve,
    vault_b: &mut TaxVault,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(arena.admin == sui_tx_context::sender(ctx), EArenaAdminOnly);

    let arena_id = sui_object::id(arena);
    let idx = find_duel_index(&arena.active_duels, duel_id);
    let now = sui_clock::timestamp_ms(clock);
    let curve_a_id = token_curve::curve_id(curve_a);
    let curve_b_id = token_curve::curve_id(curve_b);
    let volume_a;
    let volume_b;
    let winner;
    let loser;

    {
        let pair = vector::borrow_mut(&mut arena.active_duels, idx);
        assert!(pair.status == STATUS_ONGOING, EDuelNotOpen);
        assert!(now >= pair.end_time, EDuelNotOpen);
        assert!(curve_a_id == pair.token_a || curve_a_id == pair.token_b, ECurveNotInDuel);
        assert!(curve_b_id == pair.token_a || curve_b_id == pair.token_b, ECurveNotInDuel);
        assert!(curve_a_id != curve_b_id, ECurveNotInDuel);

        pair.status = STATUS_FINISHED;
        volume_a = pair.volume_a;
        volume_b = pair.volume_b;

        if (pair.volume_a > pair.volume_b) {
            pair.winner = std_option::some(pair.token_a);
            pair.loser = std_option::some(pair.token_b);
            winner = pair.token_a;
            loser = pair.token_b;
        } else if (pair.volume_b > pair.volume_a) {
            pair.winner = std_option::some(pair.token_b);
            pair.loser = std_option::some(pair.token_a);
            winner = pair.token_b;
            loser = pair.token_a;
        } else {
            pair.winner = std_option::none<ID>();
            pair.loser = std_option::none<ID>();
            winner = pair.token_a;
            loser = pair.token_b;
        };
    };

    if (volume_a > volume_b) {
        if (winner == curve_a_id) {
            settle_winner_take_all(
                arena_id,
                duel_id,
                curve_a,
                vault_a,
                curve_b,
                clock,
                ctx,
            );
        } else {
            settle_winner_take_all(
                arena_id,
                duel_id,
                curve_b,
                vault_b,
                curve_a,
                clock,
                ctx,
            );
        };
    } else if (volume_b > volume_a) {
        if (winner == curve_a_id) {
            settle_winner_take_all(
                arena_id,
                duel_id,
                curve_a,
                vault_a,
                curve_b,
                clock,
                ctx,
            );
        } else {
            settle_winner_take_all(
                arena_id,
                duel_id,
                curve_b,
                vault_b,
                curve_a,
                clock,
                ctx,
            );
        };
    };

    event::emit(DuelResolved {
        arena_id,
        duel_id,
        winner: if (volume_a > volume_b) std_option::some(winner) else if (volume_b > volume_a) std_option::some(winner) else std_option::none<ID>(),
        loser: if (volume_a > volume_b) std_option::some(loser) else if (volume_b > volume_a) std_option::some(loser) else std_option::none<ID>(),
        volume_a,
        volume_b,
        at_ms: now,
    });
}

fun settle_winner_take_all(
    arena_id: ID,
    duel_id: u64,
    winner_curve: &mut TokenCurve,
    winner_vault: &mut TaxVault,
    loser_curve: &mut TokenCurve,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let migrated_sui = token_curve::reserve_balance(loser_curve);
    if (migrated_sui == 0) {
        return
    };

    let settlement_funds = token_curve::withdraw_reserve(loser_curve, migrated_sui);
    let winner_creator = token_curve::curve_creator(winner_curve);
    let mut reward_token = token_curve::new_zero_token(winner_curve, ctx);
    let net_settlement = tax_vault::apply_tax_and_distribute(winner_vault, settlement_funds, true);
    let dust = token_curve::buy_with_balance(winner_curve, &mut reward_token, net_settlement, clock, ctx);
    let winner_tokens_bought = token_curve::token_balance(&reward_token);
    let dust_to_winner = sui_balance::value(&dust);

    if (winner_tokens_bought > 0) {
        token_curve::transfer_token(reward_token, winner_creator);
    } else {
        token_curve::destroy_zero_token(reward_token);
    };

    if (dust_to_winner > 0) {
        let dust_coin = sui_coin::from_balance(dust, ctx);
        sui_transfer::public_transfer(dust_coin, winner_creator);
    } else {
        sui_balance::destroy_zero(dust);
    };

    event::emit(LiquidityMigrated {
        arena_id,
        duel_id,
        winner_curve_id: token_curve::curve_id(winner_curve),
        loser_curve_id: token_curve::curve_id(loser_curve),
        migrated_sui,
        winner_tokens_bought,
        dust_to_winner,
        winner_creator,
        at_ms: sui_clock::timestamp_ms(clock),
    });
}

fun find_duel_index(duels: &vector<DuelPair>, duel_id: u64): u64 {
    let mut i = 0;
    let len = vector::length(duels);
    while (i < len) {
        let pair = vector::borrow(duels, i);
        if (pair.duel_id == duel_id) {
            return i
        };
        i = i + 1;
    };
    abort EDuelNotFound
}
