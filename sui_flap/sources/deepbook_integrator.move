module sui_flap::deepbook_integrator;

use std::string::{Self as std_string, String};
use sui::event;
use sui::object::{Self as sui_object};
use sui::transfer::{Self as sui_transfer};
use sui::tx_context::{Self as sui_tx_context};

use sui_flap::tax_vault::{Self, TaxVault};
use sui_flap::token_curve::{Self, TokenCurve};

const EAlreadyConfigured: u64 = 0;
const ENotGraduated: u64 = 1;

public struct DeepBookGraduation has key {
    id: UID,
    curve_id: ID,
    vault_id: ID,
    base_symbol: String,
    quote_symbol: String,
    target_pool_id: String,
    target_market_type: String,
    active: bool,
}

public struct DeepBookGraduationConfigured has copy, drop {
    graduation_id: ID,
    curve_id: ID,
    vault_id: ID,
    target_pool_id: String,
    target_market_type: String,
}

public struct DeepBookGraduationTriggered has copy, drop {
    graduation_id: ID,
    curve_id: ID,
    vault_id: ID,
    target_pool_id: String,
    quote_symbol: String,
    at_sender: address,
}

public fun create_graduation(
    curve: &TokenCurve,
    vault: &TaxVault,
    target_pool_id: vector<u8>,
    target_market_type: vector<u8>,
    quote_symbol: vector<u8>,
    ctx: &mut TxContext,
): DeepBookGraduation {
    let graduation = DeepBookGraduation {
        id: sui_object::new(ctx),
        curve_id: token_curve::curve_id(curve),
        vault_id: tax_vault::vault_id(vault),
        base_symbol: token_curve::curve_symbol(curve),
        quote_symbol: std_string::utf8(quote_symbol),
        target_pool_id: std_string::utf8(target_pool_id),
        target_market_type: std_string::utf8(target_market_type),
        active: false,
    };

    event::emit(DeepBookGraduationConfigured {
        graduation_id: sui_object::id(&graduation),
        curve_id: token_curve::curve_id(curve),
        vault_id: tax_vault::vault_id(vault),
        target_pool_id: graduation.target_pool_id,
        target_market_type: graduation.target_market_type,
    });

    graduation
}

public fun share_graduation(graduation: DeepBookGraduation) {
    sui_transfer::share_object(graduation);
}

public fun activate_graduation(
    graduation: &mut DeepBookGraduation,
    curve: &TokenCurve,
    vault: &TaxVault,
    ctx: &TxContext,
) {
    assert!(graduation.curve_id == token_curve::curve_id(curve), EAlreadyConfigured);
    assert!(graduation.vault_id == tax_vault::vault_id(vault), EAlreadyConfigured);
    assert!(token_curve::is_graduated(curve), ENotGraduated);

    graduation.active = true;

    event::emit(DeepBookGraduationTriggered {
        graduation_id: sui_object::id(graduation),
        curve_id: token_curve::curve_id(curve),
        vault_id: tax_vault::vault_id(vault),
        target_pool_id: graduation.target_pool_id,
        quote_symbol: graduation.quote_symbol,
        at_sender: sui_tx_context::sender(ctx),
    });
}

public fun graduation_id(graduation: &DeepBookGraduation): ID {
    sui_object::id(graduation)
}

public fun graduation_active(graduation: &DeepBookGraduation): bool {
    graduation.active
}
