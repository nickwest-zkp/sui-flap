module sui_flap::asset_migration;

use std::string::{Self as std_string, String};
use sui::event;
use sui::object::{Self as sui_object, ID, UID};
use sui::transfer::{Self as sui_transfer};
use sui::tx_context::{Self as sui_tx_context, TxContext};

use sui_flap::token_curve::{Self as token_curve, CreatorCap, TokenCurve};

const STATUS_OBJECT_ONLY: u8 = 0;
const STATUS_PACKAGE_QUEUED: u8 = 1;
const STATUS_COIN_LIVE: u8 = 2;

const EMigrationCapMismatch: u64 = 0;

public struct AssetMigrationPlan has key {
    id: UID,
    curve_id: ID,
    creator: address,
    preferred_pool_label: String,
    preferred_quote_symbol: String,
    status: u8,
    target_package_id: String,
    treasury_cap_id: String,
    metadata_cap_id: String,
    balance_manager_id: String,
}

public struct MigrationPlanCreated has copy, drop {
    plan_id: ID,
    curve_id: ID,
    creator: address,
    preferred_pool_label: String,
    preferred_quote_symbol: String,
    status: u8,
}

public struct MigrationPackageQueued has copy, drop {
    plan_id: ID,
    curve_id: ID,
    target_package_id: String,
    status: u8,
}

public struct MigrationCoinActivated has copy, drop {
    plan_id: ID,
    curve_id: ID,
    target_package_id: String,
    treasury_cap_id: String,
    metadata_cap_id: String,
    balance_manager_id: String,
    status: u8,
    sender: address,
}

public fun create_plan(
    curve: &TokenCurve,
    cap: &CreatorCap,
    preferred_pool_label: vector<u8>,
    preferred_quote_symbol: vector<u8>,
    ctx: &mut TxContext,
): AssetMigrationPlan {
    assert!(token_curve::curve_id(curve) == token_curve::cap_curve_id(cap), EMigrationCapMismatch);
    assert!(token_curve::curve_creator(curve) == token_curve::cap_creator(cap), EMigrationCapMismatch);

    let plan = AssetMigrationPlan {
        id: sui_object::new(ctx),
        curve_id: token_curve::curve_id(curve),
        creator: token_curve::curve_creator(curve),
        preferred_pool_label: std_string::utf8(preferred_pool_label),
        preferred_quote_symbol: std_string::utf8(preferred_quote_symbol),
        status: STATUS_OBJECT_ONLY,
        target_package_id: std_string::utf8(b""),
        treasury_cap_id: std_string::utf8(b""),
        metadata_cap_id: std_string::utf8(b""),
        balance_manager_id: std_string::utf8(b""),
    };

    event::emit(MigrationPlanCreated {
        plan_id: sui_object::id(&plan),
        curve_id: plan.curve_id,
        creator: plan.creator,
        preferred_pool_label: plan.preferred_pool_label,
        preferred_quote_symbol: plan.preferred_quote_symbol,
        status: plan.status,
    });

    plan
}

public fun share_plan(plan: AssetMigrationPlan) {
    sui_transfer::share_object(plan);
}

public fun queue_package_publish(
    plan: &mut AssetMigrationPlan,
    cap: &CreatorCap,
    target_package_id: vector<u8>,
) {
    assert!(plan.curve_id == token_curve::cap_curve_id(cap), EMigrationCapMismatch);
    assert!(plan.creator == token_curve::cap_creator(cap), EMigrationCapMismatch);

    plan.status = STATUS_PACKAGE_QUEUED;
    plan.target_package_id = std_string::utf8(target_package_id);

    event::emit(MigrationPackageQueued {
        plan_id: sui_object::id(plan),
        curve_id: plan.curve_id,
        target_package_id: plan.target_package_id,
        status: plan.status,
    });
}

public fun activate_coin_mode(
    plan: &mut AssetMigrationPlan,
    cap: &CreatorCap,
    target_package_id: vector<u8>,
    treasury_cap_id: vector<u8>,
    metadata_cap_id: vector<u8>,
    balance_manager_id: vector<u8>,
    ctx: &TxContext,
) {
    assert!(plan.curve_id == token_curve::cap_curve_id(cap), EMigrationCapMismatch);
    assert!(plan.creator == token_curve::cap_creator(cap), EMigrationCapMismatch);

    plan.status = STATUS_COIN_LIVE;
    plan.target_package_id = std_string::utf8(target_package_id);
    plan.treasury_cap_id = std_string::utf8(treasury_cap_id);
    plan.metadata_cap_id = std_string::utf8(metadata_cap_id);
    plan.balance_manager_id = std_string::utf8(balance_manager_id);

    event::emit(MigrationCoinActivated {
        plan_id: sui_object::id(plan),
        curve_id: plan.curve_id,
        target_package_id: plan.target_package_id,
        treasury_cap_id: plan.treasury_cap_id,
        metadata_cap_id: plan.metadata_cap_id,
        balance_manager_id: plan.balance_manager_id,
        status: plan.status,
        sender: sui_tx_context::sender(ctx),
    });
}

public fun migration_plan_id(plan: &AssetMigrationPlan): ID {
    sui_object::id(plan)
}

public fun migration_curve_id(plan: &AssetMigrationPlan): ID {
    plan.curve_id
}

public fun migration_status(plan: &AssetMigrationPlan): u8 {
    plan.status
}
