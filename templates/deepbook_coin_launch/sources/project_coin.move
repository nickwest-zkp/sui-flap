module deepbook_coin_launch::project_coin;

use sui::tx_context::TxContext;
use sui_flap::coin_launch;

public struct PROJECT_COIN has drop {}

fun init(witness: PROJECT_COIN, ctx: &mut TxContext) {
    coin_launch::create_and_share_launch<PROJECT_COIN>(
        witness,
        9,
        b"Project Coin",
        b"PCOIN",
        b"DeepBook-ready launch coin created through SuiFlap.",
        b"",
        500,
        50_000,
        1,
        500,
        1_000_000_000,
        1_000_000,
        150,
        250,
        7_000,
        b"PCOIN/SUI",
        b"SUI",
        ctx,
    );
}
