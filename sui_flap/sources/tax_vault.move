module sui_flap::tax_vault;

use sui::balance::{Self as sui_balance, Balance};
use sui::clock::Clock;
use sui::coin::{Self as sui_coin, Coin};
use sui::event;
use sui::object::{Self as sui_object};
use sui::sui::SUI;
use sui_flap::token_curve::{Self, CreatorCap, LaunchToken, TokenCurve};

const BPS_DENOMINATOR: u64 = 10_000;

const EInvalidBps: u64 = 0;
const EVaultCapMismatch: u64 = 1;
const EEmptyCreatorVault: u64 = 2;

public struct TaxVault has key {
    id: UID,
    curve_id: ID,
    creator: address,
    buy_tax_bps: u64,
    sell_tax_bps: u64,
    vault_percentage_bps: u64,
    creator_fees: Balance<SUI>,
    protocol_fees: Balance<SUI>,
    total_tax_collected: u64,
    total_creator_claimed: u64,
}

public struct VaultCreated has copy, drop {
    vault_id: ID,
    curve_id: ID,
    creator: address,
    buy_tax_bps: u64,
    sell_tax_bps: u64,
}

public struct TaxApplied has copy, drop {
    vault_id: ID,
    curve_id: ID,
    is_buy: bool,
    gross_amount: u64,
    tax_amount: u64,
    creator_cut: u64,
    protocol_cut: u64,
}

public struct VaultClaimed has copy, drop {
    vault_id: ID,
    creator: address,
    amount: u64,
}

public fun create_vault_for_curve(
    curve: &TokenCurve,
    cap: &CreatorCap,
    buy_tax_bps: u64,
    sell_tax_bps: u64,
    vault_percentage_bps: u64,
    ctx: &mut TxContext,
): TaxVault {
    assert!(buy_tax_bps <= BPS_DENOMINATOR, EInvalidBps);
    assert!(sell_tax_bps <= BPS_DENOMINATOR, EInvalidBps);
    assert!(vault_percentage_bps <= BPS_DENOMINATOR, EInvalidBps);
    assert!(token_curve::curve_id(curve) == token_curve::cap_curve_id(cap), EVaultCapMismatch);
    assert!(token_curve::curve_creator(curve) == token_curve::cap_creator(cap), EVaultCapMismatch);

    let vault = TaxVault {
        id: sui_object::new(ctx),
        curve_id: token_curve::curve_id(curve),
        creator: token_curve::curve_creator(curve),
        buy_tax_bps,
        sell_tax_bps,
        vault_percentage_bps,
        creator_fees: sui_balance::zero<SUI>(),
        protocol_fees: sui_balance::zero<SUI>(),
        total_tax_collected: 0,
        total_creator_claimed: 0,
    };

    event::emit(VaultCreated {
        vault_id: sui_object::id(&vault),
        curve_id: token_curve::curve_id(curve),
        creator: token_curve::curve_creator(curve),
        buy_tax_bps,
        sell_tax_bps,
    });

    vault
}

public fun taxed_buy(
    curve: &mut TokenCurve,
    vault: &mut TaxVault,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): (LaunchToken, Coin<SUI>) {
    let mut token = token_curve::new_zero_token(curve, ctx);
    let change = taxed_buy_into_token(curve, vault, &mut token, payment, clock, ctx);
    (token, change)
}

public fun taxed_buy_into_token(
    curve: &mut TokenCurve,
    vault: &mut TaxVault,
    token: &mut LaunchToken,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(vault.curve_id == token_curve::curve_id(curve), EVaultCapMismatch);
    let net_payment = apply_tax_and_distribute(vault, sui_coin::into_balance(payment), true);
    let change = token_curve::buy_with_balance(curve, token, net_payment, clock, ctx);
    sui_coin::from_balance(change, ctx)
}

public fun taxed_sell(
    curve: &mut TokenCurve,
    vault: &mut TaxVault,
    token: &mut LaunchToken,
    token_amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(vault.curve_id == token_curve::curve_id(curve), EVaultCapMismatch);
    let gross_payout = token_curve::sell_for_balance(curve, token, token_amount, clock, ctx);
    let net_payout = apply_tax_and_distribute(vault, gross_payout, false);
    sui_coin::from_balance(net_payout, ctx)
}

public fun claim_vault_funds(
    vault: &mut TaxVault,
    cap: &CreatorCap,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(vault.curve_id == token_curve::cap_curve_id(cap), EVaultCapMismatch);
    assert!(vault.creator == token_curve::cap_creator(cap), EVaultCapMismatch);

    let amount = sui_balance::value(&vault.creator_fees);
    assert!(amount > 0, EEmptyCreatorVault);

    vault.total_creator_claimed = vault.total_creator_claimed + amount;
    let payout = sui_balance::split(&mut vault.creator_fees, amount);

    event::emit(VaultClaimed {
        vault_id: sui_object::id(vault),
        creator: vault.creator,
        amount,
    });

    sui_coin::from_balance(payout, ctx)
}

public fun apply_tax_and_distribute(
    vault: &mut TaxVault,
    payment: Balance<SUI>,
    is_buy: bool,
): Balance<SUI> {
    let mut payment = payment;
    let gross_amount = sui_balance::value(&payment);
    let tax_bps = if (is_buy) vault.buy_tax_bps else vault.sell_tax_bps;
    let tax_amount = gross_amount * tax_bps / BPS_DENOMINATOR;

    if (tax_amount == 0) {
        return payment
    };

    let mut tax_balance = sui_balance::split(&mut payment, tax_amount);
    let creator_cut = tax_amount * vault.vault_percentage_bps / BPS_DENOMINATOR;
    let protocol_cut = tax_amount - creator_cut;

    if (creator_cut > 0) {
        let creator_balance = sui_balance::split(&mut tax_balance, creator_cut);
        sui_balance::join(&mut vault.creator_fees, creator_balance);
    };

    if (protocol_cut == 0) {
        sui_balance::destroy_zero(tax_balance);
    } else {
        sui_balance::join(&mut vault.protocol_fees, tax_balance);
    };

    vault.total_tax_collected = vault.total_tax_collected + tax_amount;

    event::emit(TaxApplied {
        vault_id: sui_object::id(vault),
        curve_id: vault.curve_id,
        is_buy,
        gross_amount,
        tax_amount,
        creator_cut,
        protocol_cut,
    });

    payment
}

public fun vault_id(vault: &TaxVault): ID {
    sui_object::id(vault)
}

public fun vault_curve_id(vault: &TaxVault): ID {
    vault.curve_id
}

public fun vault_creator(vault: &TaxVault): address {
    vault.creator
}

public fun vault_buy_tax_bps(vault: &TaxVault): u64 {
    vault.buy_tax_bps
}

public fun vault_sell_tax_bps(vault: &TaxVault): u64 {
    vault.sell_tax_bps
}

public fun vault_share_bps(vault: &TaxVault): u64 {
    vault.vault_percentage_bps
}

public fun creator_fees_balance(vault: &TaxVault): u64 {
    sui_balance::value(&vault.creator_fees)
}

public fun protocol_fees_balance(vault: &TaxVault): u64 {
    sui_balance::value(&vault.protocol_fees)
}
