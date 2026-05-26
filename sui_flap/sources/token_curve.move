module sui_flap::token_curve;

use std::string::{Self as std_string, String};
use sui::balance::{Self as sui_balance, Balance};
use sui::clock::{Self as sui_clock, Clock};
use sui::coin::{Self as sui_coin, Coin};
use sui::event;
use sui::object::{Self as sui_object};
use sui::sui::SUI;
use sui::transfer::{Self as sui_transfer};
use sui::tx_context::{Self as sui_tx_context};

const ECurveAlreadyGraduated: u64 = 0;
const EInsufficientPayment: u64 = 1;
const EInsufficientCurveReserve: u64 = 2;
const EInvalidPriceConfig: u64 = 3;
const ETokenCurveMismatch: u64 = 4;
const EInsufficientLaunchTokenBalance: u64 = 5;
const EZeroSplitAmount: u64 = 6;

public struct CreatorCap has key, store {
    id: UID,
    curve_id: ID,
    creator: address,
}

public struct LaunchToken has key, store {
    id: UID,
    curve_id: ID,
    balance: u64,
}

public struct TokenCurve has key {
    id: UID,
    name: String,
    symbol: String,
    description: String,
    walrus_blob_id: String,
    creator: address,
    virtual_sui: u64,
    virtual_token: u64,
    base_price: u64,
    price_step_bps: u64,
    graduation_threshold: u64,
    raised_sui: u64,
    reserve: Balance<SUI>,
    circulating_supply: u64,
    graduated: bool,
}

public struct LaunchCreated has copy, drop {
    curve_id: ID,
    creator: address,
    symbol: String,
    walrus_blob_id: String,
}

public struct BuyExecuted has copy, drop {
    curve_id: ID,
    buyer: address,
    paid_sui: u64,
    minted_token_amount: u64,
    new_price: u64,
    at_ms: u64,
}

public struct SellExecuted has copy, drop {
    curve_id: ID,
    seller: address,
    burned_token_amount: u64,
    paid_out_sui: u64,
    new_price: u64,
    at_ms: u64,
}

public struct Graduated has copy, drop {
    curve_id: ID,
    raised_sui: u64,
    at_ms: u64,
}

public struct TokenSplit has copy, drop {
    curve_id: ID,
    parent_token_id: ID,
    child_token_id: ID,
    amount: u64,
}

public struct TokenMerged has copy, drop {
    curve_id: ID,
    target_token_id: ID,
    merged_token_id: ID,
    amount: u64,
}

public struct ReserveWithdrawn has copy, drop {
    curve_id: ID,
    amount: u64,
}

public fun create_token(
    name: vector<u8>,
    symbol: vector<u8>,
    description: vector<u8>,
    walrus_blob_id: vector<u8>,
    virtual_sui: u64,
    virtual_token: u64,
    base_price: u64,
    price_step_bps: u64,
    graduation_threshold: u64,
    ctx: &mut TxContext,
): (TokenCurve, CreatorCap) {
    assert!(base_price > 0, EInvalidPriceConfig);

    let creator = tx_context::sender(ctx);
    let curve = TokenCurve {
        id: sui_object::new(ctx),
        name: std_string::utf8(name),
        symbol: std_string::utf8(symbol),
        description: std_string::utf8(description),
        walrus_blob_id: std_string::utf8(walrus_blob_id),
        creator,
        virtual_sui,
        virtual_token,
        base_price,
        price_step_bps,
        graduation_threshold,
        raised_sui: 0,
        reserve: sui_balance::zero<SUI>(),
        circulating_supply: 0,
        graduated: false,
    };

    let curve_id = sui_object::id(&curve);
    let cap = CreatorCap {
        id: sui_object::new(ctx),
        curve_id,
        creator,
    };

    event::emit(LaunchCreated {
        curve_id,
        creator,
        symbol: std_string::utf8(symbol),
        walrus_blob_id: std_string::utf8(walrus_blob_id),
    });

    (curve, cap)
}

public fun share_curve(curve: TokenCurve) {
    sui_transfer::share_object(curve);
}

public fun new_zero_token(curve: &TokenCurve, ctx: &mut TxContext): LaunchToken {
    LaunchToken {
        id: sui_object::new(ctx),
        curve_id: sui_object::id(curve),
        balance: 0,
    }
}

public fun buy(
    curve: &mut TokenCurve,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): (LaunchToken, Coin<SUI>) {
    let mut token = new_zero_token(curve, ctx);
    let change = buy_into_token(curve, &mut token, payment, clock, ctx);
    (token, change)
}

public fun buy_into_token(
    curve: &mut TokenCurve,
    token: &mut LaunchToken,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    let change = buy_with_balance(curve, token, sui_coin::into_balance(payment), clock, ctx);
    sui_coin::from_balance(change, ctx)
}

public fun sell(
    curve: &mut TokenCurve,
    token: &mut LaunchToken,
    token_amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    let payout = sell_for_balance(curve, token, token_amount, clock, ctx);
    sui_coin::from_balance(payout, ctx)
}

public fun split_token(
    token: &mut LaunchToken,
    amount: u64,
    ctx: &mut TxContext,
): LaunchToken {
    assert!(amount > 0, EZeroSplitAmount);
    assert!(token.balance >= amount, EInsufficientLaunchTokenBalance);

    token.balance = token.balance - amount;
    let child = LaunchToken {
        id: sui_object::new(ctx),
        curve_id: token.curve_id,
        balance: amount,
    };

    event::emit(TokenSplit {
        curve_id: token.curve_id,
        parent_token_id: sui_object::id(token),
        child_token_id: sui_object::id(&child),
        amount,
    });

    child
}

public fun merge_tokens(
    target: &mut LaunchToken,
    merged: LaunchToken,
) {
    let LaunchToken {
        id,
        curve_id,
        balance,
    } = merged;

    let merged_token_id = sui_object::uid_to_inner(&id);
    assert!(target.curve_id == curve_id, ETokenCurveMismatch);

    target.balance = target.balance + balance;
    sui_object::delete(id);

    event::emit(TokenMerged {
        curve_id: target.curve_id,
        target_token_id: sui_object::id(target),
        merged_token_id,
        amount: balance,
    });
}

public fun transfer_token(
    token: LaunchToken,
    recipient: address,
) {
    sui_transfer::public_transfer(token, recipient);
}

public fun destroy_zero_token(token: LaunchToken) {
    assert!(token.balance == 0, EInsufficientLaunchTokenBalance);
    let LaunchToken {
        id,
        curve_id: _,
        balance: _,
    } = token;
    sui_object::delete(id);
}

public(package) fun withdraw_reserve(
    curve: &mut TokenCurve,
    amount: u64,
): Balance<SUI> {
    assert!(sui_balance::value(&curve.reserve) >= amount, EInsufficientCurveReserve);
    curve.raised_sui = curve.raised_sui - amount;

    event::emit(ReserveWithdrawn {
        curve_id: sui_object::id(curve),
        amount,
    });

    sui_balance::split(&mut curve.reserve, amount)
}

public fun reserve_balance(curve: &TokenCurve): u64 {
    sui_balance::value(&curve.reserve)
}

public(package) fun buy_with_balance(
    curve: &mut TokenCurve,
    token: &mut LaunchToken,
    mut payment: Balance<SUI>,
    clock: &Clock,
    ctx: &TxContext,
): Balance<SUI> {
    assert!(!curve.graduated, ECurveAlreadyGraduated);
    assert!(token.curve_id == sui_object::id(curve), ETokenCurveMismatch);

    let unit_price = current_unit_price(curve);
    let payment_value = sui_balance::value(&payment);
    assert!(payment_value >= unit_price, EInsufficientPayment);

    let token_amount = payment_value / unit_price;
    assert!(token_amount > 0, EInsufficientPayment);

    let spent_sui = token_amount * unit_price;
    let spend_balance = sui_balance::split(&mut payment, spent_sui);
    sui_balance::join(&mut curve.reserve, spend_balance);

    curve.raised_sui = curve.raised_sui + spent_sui;
    curve.circulating_supply = curve.circulating_supply + token_amount;
    token.balance = token.balance + token_amount;

    try_graduation(curve, clock);

    event::emit(BuyExecuted {
        curve_id: sui_object::id(curve),
        buyer: sui_tx_context::sender(ctx),
        paid_sui: spent_sui,
        minted_token_amount: token_amount,
        new_price: current_unit_price(curve),
        at_ms: sui_clock::timestamp_ms(clock),
    });

    payment
}

public(package) fun sell_for_balance(
    curve: &mut TokenCurve,
    token: &mut LaunchToken,
    token_amount: u64,
    clock: &Clock,
    ctx: &TxContext,
): Balance<SUI> {
    assert!(token.curve_id == sui_object::id(curve), ETokenCurveMismatch);
    assert!(token.balance >= token_amount, EInsufficientLaunchTokenBalance);

    let unit_price = current_unit_price(curve);
    let gross_payout = token_amount * unit_price;
    assert!(sui_balance::value(&curve.reserve) >= gross_payout, EInsufficientCurveReserve);

    let payout = sui_balance::split(&mut curve.reserve, gross_payout);
    token.balance = token.balance - token_amount;
    curve.circulating_supply = curve.circulating_supply - token_amount;
    curve.raised_sui = curve.raised_sui - gross_payout;

    event::emit(SellExecuted {
        curve_id: sui_object::id(curve),
        seller: sui_tx_context::sender(ctx),
        burned_token_amount: token_amount,
        paid_out_sui: gross_payout,
        new_price: current_unit_price(curve),
        at_ms: sui_clock::timestamp_ms(clock),
    });

    payout
}

public fun try_graduation(curve: &mut TokenCurve, clock: &Clock) {
    if (!curve.graduated && curve.raised_sui >= curve.graduation_threshold) {
        curve.graduated = true;
        event::emit(Graduated {
            curve_id: sui_object::id(curve),
            raised_sui: curve.raised_sui,
            at_ms: sui_clock::timestamp_ms(clock),
        });
    }
}

public fun current_unit_price(curve: &TokenCurve): u64 {
    let effective_raised = curve.raised_sui + curve.virtual_sui;
    let effective_supply = curve.circulating_supply + curve.virtual_token + 1;
    curve.base_price + ((effective_raised / effective_supply) * curve.price_step_bps / 10_000)
}

public fun curve_id(curve: &TokenCurve): ID {
    sui_object::id(curve)
}

public fun curve_creator(curve: &TokenCurve): address {
    curve.creator
}

public fun curve_symbol(curve: &TokenCurve): String {
    curve.symbol
}

public fun cap_curve_id(cap: &CreatorCap): ID {
    cap.curve_id
}

public fun cap_creator(cap: &CreatorCap): address {
    cap.creator
}

public fun token_balance(token: &LaunchToken): u64 {
    token.balance
}

public fun token_curve_id(token: &LaunchToken): ID {
    token.curve_id
}

public fun is_graduated(curve: &TokenCurve): bool {
    curve.graduated
}
