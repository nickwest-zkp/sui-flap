module sui_flap::sample_coin;

use sui::coin_registry::MetadataCap;
use sui::transfer::{Self as sui_transfer};
use sui::tx_context::TxContext;

use sui_flap::coin_launch::{Self, CoinCreatorCap, CoinCurve, CoinTaxVault};

public struct SAMPLE_COIN has drop {}

public fun create_sample_launch(
    witness: SAMPLE_COIN,
    ctx: &mut TxContext,
): (CoinCurve<SAMPLE_COIN>, CoinTaxVault<SAMPLE_COIN>, CoinCreatorCap<SAMPLE_COIN>, MetadataCap<SAMPLE_COIN>) {
    coin_launch::create_launch<SAMPLE_COIN>(
        witness,
        9,
        b"SuiFlap Sample",
        b"SFLAP",
        b"Sample coin launch using the DeepBook-ready Coin<T> path.",
        b"",
        500,
        50_000,
        1,
        500,
        6_000,
        1_000_000,
        150,
        250,
        7_000,
        b"SFLAP/SUI",
        b"SUI",
        ctx,
    )
}

public fun share_sample_curve(curve: CoinCurve<SAMPLE_COIN>) {
    coin_launch::share_curve(curve);
}

public fun share_sample_vault(vault: CoinTaxVault<SAMPLE_COIN>) {
    coin_launch::share_vault(vault);
}

public fun transfer_sample_cap_and_metadata(
    cap: CoinCreatorCap<SAMPLE_COIN>,
    metadata: MetadataCap<SAMPLE_COIN>,
    recipient: address,
) {
    sui_transfer::public_transfer(cap, recipient);
    sui_transfer::public_transfer(metadata, recipient);
}
