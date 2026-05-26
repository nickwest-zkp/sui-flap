# SuiFlap Prototype

This repository now contains a minimal Sui Move prototype for a Sui + Walrus memecoin launchpad focused on three core flows:

- `token_curve`: launch object, simplified bonding curve, transferable token objects, graduation event
- `tax_vault`: buy/sell tax routing, creator perpetual vault accounting, claim flow
- `duel`: shared arena for PvP token volume battles
- `deepbook_integrator` + `asset_migration`: DeepBook graduation routing and object-to-coin migration planning
- `coin_launch`: DeepBook-ready `Coin<T>` launch path with real fungible coins, tax vaults, metadata caps, and graduation asset release
- `sample_coin`: example static launch coin module for testing the `Coin<T>` path

## Current Scope

The Move package is under [sui_flap](D:\workspace\sui-flap\sui_flap).

The package now has two launch paths:

- It uses transferable `LaunchToken` objects instead of runtime-created custom `Coin<T>` types.
- It also includes a DeepBook-ready `Coin<T>` path for launches published with a static coin type.
- It emits events and models the core objects/capabilities needed for a frontend and indexer.
- Duel resolution currently records the winner/loser and leaves "loser liquidity auto-buy winner token" as a next implementation step.
- DeepBook graduation for the `Coin<T>` path releases base token and SUI reserve coins that a frontend PTB can pass into the official DeepBook SDK for pool creation, BalanceManager deposits, or maker orders.

## Why Not Dynamic `Coin<T>`?

Sui cannot mint arbitrary new `Coin<T>` types at runtime from one already-published package the way an EVM launchpad can deploy unlimited new ERC-20 contracts.

For a Pump.fun-style multi-launch contract, the practical on-chain pattern is:

- one shared `TokenCurve` object per launch
- one transferable `LaunchToken` object per holder or per lot
- split / merge / transfer at the object level

This keeps launches dynamic while still giving holders real transferable on-chain assets.

## Suggested Build Order

1. Add zero-balance token cleanup and optional holder registry/indexing.
2. Implement duel winner settlement so loser-side reserved liquidity auto-buys the winner.
3. Add graduation integration for Cetus/Turbos CLMM pool creation.
4. Add Walrus upload flow in frontend and persist blob IDs into launch objects.
5. Add tests for pricing math, tax splits, split/merge, and duel lifecycle.

## DeepBook Constraint

DeepBook V3 operates on real `Coin<T>` assets and shared CLOB pools. This prototype still uses transferable `LaunchToken` objects so one package can support many launches dynamically.

That means:

- the current prototype can mark a launch as DeepBook-ready
- it can store the intended DeepBook pool / quote route
- it cannot directly place the current `LaunchToken` object on DeepBook without a later redesign that mints a static `Coin<T>` asset per launch

The added `coin_launch` module is the path that can actually graduate to DeepBook because it mints real `Coin<T>` assets. The older `deepbook_integrator` and `asset_migration` modules remain as a coordination layer for the object-token prototype.
