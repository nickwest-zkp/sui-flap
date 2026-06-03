module sui_flap::coin_launch;

use std::ascii::String as AsciiString;
use std::string::{Self as std_string, String};
use std::type_name;
use sui::balance::{Self as sui_balance, Balance};
use sui::clock::{Self as sui_clock, Clock};
use sui::coin::{Self as sui_coin, Coin, TreasuryCap};
use sui::coin_registry::{Self as coin_registry, MetadataCap};
use sui::event;
use sui::object::{Self as sui_object, ID, UID};
use sui::sui::SUI;
use sui::transfer::{Self as sui_transfer};
use sui::tx_context::{Self as sui_tx_context, TxContext};

const BPS_DENOMINATOR: u64 = 10_000;

const EInvalidPriceConfig: u64 = 0;
const EInvalidBps: u64 = 1;
const ECurveAlreadyGraduated: u64 = 2;
const ECurveNotGraduated: u64 = 3;
const EAlreadyMigrated: u64 = 4;
const ECapMismatch: u64 = 5;
const EInsufficientPayment: u64 = 6;
const EInsufficientReserve: u64 = 7;
const EEmptyVault: u64 = 8;

public struct CoinCreatorCap<phantom T> has key, store {
    id: UID,
    curve_id: ID,
    creator: address,
}

public struct CoinCurve<phantom T> has key {
    id: UID,
    name: String,
    symbol: String,
    description: String,
    walrus_blob_id: String,
    creator: address,
    treasury_cap: TreasuryCap<T>,
    virtual_sui: u64,
    virtual_token: u64,
    base_price: u64,
    price_step_bps: u64,
    graduation_threshold: u64,
    graduation_token_liquidity: u64,
    raised_sui: u64,
    reserve: Balance<SUI>,
    circulating_supply: u64,
    graduated: bool,
    deepbook_migrated: bool,
    target_pool_label: String,
    quote_symbol: String,
    balance_manager_id: String,
}

public struct CoinTaxVault<phantom T> has key {
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

public struct CoinLaunchCreated has copy, drop {
    curve_id: ID,
    vault_id: ID,
    creator: address,
    coin_type: AsciiString,
    symbol: String,
    walrus_blob_id: String,
    target_pool_label: String,
    quote_symbol: String,
}

public struct CoinLaunchShared has copy, drop {
    curve_id: ID,
    vault_id: ID,
    cap_id: ID,
    creator: address,
    coin_type: AsciiString,
}

public struct CoinBuyExecuted has copy, drop {
    curve_id: ID,
    buyer: address,
    paid_sui: u64,
    minted_token_amount: u64,
    new_price: u64,
    at_ms: u64,
}

public struct CoinSellExecuted has copy, drop {
    curve_id: ID,
    seller: address,
    burned_token_amount: u64,
    paid_out_sui: u64,
    new_price: u64,
    at_ms: u64,
}

public struct CoinCurveGraduated has copy, drop {
    curve_id: ID,
    raised_sui: u64,
    at_ms: u64,
}

public struct DeepBookMigrationPrepared has copy, drop {
    curve_id: ID,
    creator: address,
    coin_type: AsciiString,
    base_coin_amount: u64,
    quote_sui_amount: u64,
    target_pool_label: String,
    quote_symbol: String,
    balance_manager_id: String,
    at_ms: u64,
}

public struct CoinVaultClaimed has copy, drop {
    vault_id: ID,
    creator: address,
    amount: u64,
}

public fun create_launch<T: drop>(
    witness: T,
    decimals: u8,
    name: vector<u8>,
    symbol: vector<u8>,
    description: vector<u8>,
    walrus_blob_id: vector<u8>,
    virtual_sui: u64,
    virtual_token: u64,
    base_price: u64,
    price_step_bps: u64,
    graduation_threshold: u64,
    graduation_token_liquidity: u64,
    buy_tax_bps: u64,
    sell_tax_bps: u64,
    vault_percentage_bps: u64,
    target_pool_label: vector<u8>,
    quote_symbol: vector<u8>,
    ctx: &mut TxContext,
): (CoinCurve<T>, CoinTaxVault<T>, CoinCreatorCap<T>, MetadataCap<T>) {
    assert!(base_price > 0, EInvalidPriceConfig);
    assert!(buy_tax_bps <= BPS_DENOMINATOR, EInvalidBps);
    assert!(sell_tax_bps <= BPS_DENOMINATOR, EInvalidBps);
    assert!(vault_percentage_bps <= BPS_DENOMINATOR, EInvalidBps);

    let (currency_init, treasury_cap) = coin_registry::new_currency_with_otw<T>(
        witness,
        decimals,
        std_string::utf8(symbol),
        std_string::utf8(name),
        std_string::utf8(description),
        std_string::utf8(b""),
        ctx,
    );
    let metadata_cap = coin_registry::finalize<T>(currency_init, ctx);

    let creator = sui_tx_context::sender(ctx);
    let curve = CoinCurve {
        id: sui_object::new(ctx),
        name: std_string::utf8(name),
        symbol: std_string::utf8(symbol),
        description: std_string::utf8(description),
        walrus_blob_id: std_string::utf8(walrus_blob_id),
        creator,
        treasury_cap,
        virtual_sui,
        virtual_token,
        base_price,
        price_step_bps,
        graduation_threshold,
        graduation_token_liquidity,
        raised_sui: 0,
        reserve: sui_balance::zero<SUI>(),
        circulating_supply: 0,
        graduated: false,
        deepbook_migrated: false,
        target_pool_label: std_string::utf8(target_pool_label),
        quote_symbol: std_string::utf8(quote_symbol),
        balance_manager_id: std_string::utf8(b""),
    };

    let curve_id = sui_object::id(&curve);
    let vault = CoinTaxVault {
        id: sui_object::new(ctx),
        curve_id,
        creator,
        buy_tax_bps,
        sell_tax_bps,
        vault_percentage_bps,
        creator_fees: sui_balance::zero<SUI>(),
        protocol_fees: sui_balance::zero<SUI>(),
        total_tax_collected: 0,
        total_creator_claimed: 0,
    };
    let cap = CoinCreatorCap {
        id: sui_object::new(ctx),
        curve_id,
        creator,
    };

    event::emit(CoinLaunchCreated {
        curve_id,
        vault_id: sui_object::id(&vault),
        creator,
        coin_type: type_name::with_defining_ids<T>().into_string(),
        symbol: curve.symbol,
        walrus_blob_id: curve.walrus_blob_id,
        target_pool_label: curve.target_pool_label,
        quote_symbol: curve.quote_symbol,
    });

    (curve, vault, cap, metadata_cap)
}

public fun share_curve<T>(curve: CoinCurve<T>) {
    sui_transfer::share_object(curve);
}

public fun share_vault<T>(vault: CoinTaxVault<T>) {
    sui_transfer::share_object(vault);
}

public fun create_and_share_launch<T: drop>(
    witness: T,
    decimals: u8,
    name: vector<u8>,
    symbol: vector<u8>,
    description: vector<u8>,
    walrus_blob_id: vector<u8>,
    virtual_sui: u64,
    virtual_token: u64,
    base_price: u64,
    price_step_bps: u64,
    graduation_threshold: u64,
    graduation_token_liquidity: u64,
    buy_tax_bps: u64,
    sell_tax_bps: u64,
    vault_percentage_bps: u64,
    target_pool_label: vector<u8>,
    quote_symbol: vector<u8>,
    ctx: &mut TxContext,
) {
    let (curve, vault, cap, metadata_cap) = create_launch<T>(
        witness,
        decimals,
        name,
        symbol,
        description,
        walrus_blob_id,
        virtual_sui,
        virtual_token,
        base_price,
        price_step_bps,
        graduation_threshold,
        graduation_token_liquidity,
        buy_tax_bps,
        sell_tax_bps,
        vault_percentage_bps,
        target_pool_label,
        quote_symbol,
        ctx,
    );

    let curve_id = sui_object::id(&curve);
    let vault_id = sui_object::id(&vault);
    let cap_id = sui_object::id(&cap);
    let creator = sui_tx_context::sender(ctx);

    sui_transfer::share_object(curve);
    sui_transfer::share_object(vault);
    sui_transfer::public_transfer(cap, creator);
    sui_transfer::public_transfer(metadata_cap, creator);

    event::emit(CoinLaunchShared {
        curve_id,
        vault_id,
        cap_id,
        creator,
        coin_type: type_name::with_defining_ids<T>().into_string(),
    });
}

public fun buy<T>(
    curve: &mut CoinCurve<T>,
    vault: &mut CoinTaxVault<T>,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<T>, Coin<SUI>) {
    assert!(vault.curve_id == sui_object::id(curve), ECapMismatch);
    assert!(!curve.graduated, ECurveAlreadyGraduated);

    let mut net_payment = apply_tax_and_distribute(vault, sui_coin::into_balance(payment), true);
    let unit_price = current_unit_price(curve);
    let payment_value = sui_balance::value(&net_payment);
    assert!(payment_value >= unit_price, EInsufficientPayment);

    let token_amount = payment_value / unit_price;
    assert!(token_amount > 0, EInsufficientPayment);

    let spent_sui = token_amount * unit_price;
    let spent_balance = sui_balance::split(&mut net_payment, spent_sui);
    sui_balance::join(&mut curve.reserve, spent_balance);

    curve.raised_sui = curve.raised_sui + spent_sui;
    curve.circulating_supply = curve.circulating_supply + token_amount;
    let token = sui_coin::mint(&mut curve.treasury_cap, token_amount, ctx);

    try_graduation(curve, clock);

    event::emit(CoinBuyExecuted {
        curve_id: sui_object::id(curve),
        buyer: sui_tx_context::sender(ctx),
        paid_sui: spent_sui,
        minted_token_amount: token_amount,
        new_price: current_unit_price(curve),
        at_ms: sui_clock::timestamp_ms(clock),
    });

    (token, sui_coin::from_balance(net_payment, ctx))
}

public fun sell<T>(
    curve: &mut CoinCurve<T>,
    vault: &mut CoinTaxVault<T>,
    token: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(vault.curve_id == sui_object::id(curve), ECapMismatch);
    assert!(!curve.deepbook_migrated, EAlreadyMigrated);

    let token_amount = sui_coin::value(&token);
    let unit_price = current_unit_price(curve);
    let gross_payout = token_amount * unit_price;
    assert!(sui_balance::value(&curve.reserve) >= gross_payout, EInsufficientReserve);

    sui_coin::burn(&mut curve.treasury_cap, token);
    let payout = sui_balance::split(&mut curve.reserve, gross_payout);
    curve.circulating_supply = curve.circulating_supply - token_amount;
    curve.raised_sui = curve.raised_sui - gross_payout;
    let net_payout = apply_tax_and_distribute(vault, payout, false);

    event::emit(CoinSellExecuted {
        curve_id: sui_object::id(curve),
        seller: sui_tx_context::sender(ctx),
        burned_token_amount: token_amount,
        paid_out_sui: sui_balance::value(&net_payout),
        new_price: current_unit_price(curve),
        at_ms: sui_clock::timestamp_ms(clock),
    });

    sui_coin::from_balance(net_payout, ctx)
}

public fun graduate_to_deepbook<T>(
    curve: &mut CoinCurve<T>,
    vault: &CoinTaxVault<T>,
    cap: &CoinCreatorCap<T>,
    balance_manager_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<T>, Coin<SUI>) {
    assert!(vault.curve_id == sui_object::id(curve), ECapMismatch);
    assert!(cap.curve_id == sui_object::id(curve), ECapMismatch);
    assert!(cap.creator == curve.creator, ECapMismatch);
    assert!(curve.graduated, ECurveNotGraduated);
    assert!(!curve.deepbook_migrated, EAlreadyMigrated);

    curve.deepbook_migrated = true;
    curve.balance_manager_id = std_string::utf8(balance_manager_id);

    let quote_sui_amount = sui_balance::value(&curve.reserve);
    let quote = sui_balance::split(&mut curve.reserve, quote_sui_amount);
    let base = sui_coin::mint(&mut curve.treasury_cap, curve.graduation_token_liquidity, ctx);

    event::emit(DeepBookMigrationPrepared {
        curve_id: sui_object::id(curve),
        creator: curve.creator,
        coin_type: type_name::with_defining_ids<T>().into_string(),
        base_coin_amount: curve.graduation_token_liquidity,
        quote_sui_amount,
        target_pool_label: curve.target_pool_label,
        quote_symbol: curve.quote_symbol,
        balance_manager_id: curve.balance_manager_id,
        at_ms: sui_clock::timestamp_ms(clock),
    });

    (base, sui_coin::from_balance(quote, ctx))
}

public fun claim_vault_funds<T>(
    vault: &mut CoinTaxVault<T>,
    cap: &CoinCreatorCap<T>,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(vault.curve_id == cap.curve_id, ECapMismatch);
    assert!(vault.creator == cap.creator, ECapMismatch);

    let amount = sui_balance::value(&vault.creator_fees);
    assert!(amount > 0, EEmptyVault);

    vault.total_creator_claimed = vault.total_creator_claimed + amount;
    let payout = sui_balance::split(&mut vault.creator_fees, amount);

    event::emit(CoinVaultClaimed {
        vault_id: sui_object::id(vault),
        creator: vault.creator,
        amount,
    });

    sui_coin::from_balance(payout, ctx)
}

fun apply_tax_and_distribute<T>(
    vault: &mut CoinTaxVault<T>,
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

    payment
}

fun try_graduation<T>(curve: &mut CoinCurve<T>, clock: &Clock) {
    if (!curve.graduated && curve.raised_sui >= curve.graduation_threshold) {
        curve.graduated = true;
        event::emit(CoinCurveGraduated {
            curve_id: sui_object::id(curve),
            raised_sui: curve.raised_sui,
            at_ms: sui_clock::timestamp_ms(clock),
        });
    }
}

public fun current_unit_price<T>(curve: &CoinCurve<T>): u64 {
    let effective_raised = curve.raised_sui + curve.virtual_sui;
    let effective_supply = curve.circulating_supply + curve.virtual_token + 1;
    curve.base_price + ((effective_raised / effective_supply) * curve.price_step_bps / BPS_DENOMINATOR)
}

public fun curve_id<T>(curve: &CoinCurve<T>): ID {
    sui_object::id(curve)
}

public fun vault_id<T>(vault: &CoinTaxVault<T>): ID {
    sui_object::id(vault)
}

public fun cap_curve_id<T>(cap: &CoinCreatorCap<T>): ID {
    cap.curve_id
}

public fun is_graduated<T>(curve: &CoinCurve<T>): bool {
    curve.graduated
}

public fun is_deepbook_migrated<T>(curve: &CoinCurve<T>): bool {
    curve.deepbook_migrated
}
