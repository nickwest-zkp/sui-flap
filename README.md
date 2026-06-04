# SuiFlap

SuiFlap is a Sui-native launchpad prototype for memecoin-style launches, creator vaults, PvP token duels, and DeepBook graduation.

The current implementation has two launch paths:

- `coin_launch`: the real DeepBook-ready path. Each launch uses a static `Coin<T>` type, trades through a bonding curve, creates tax vault accounting, and can graduate liquidity into DeepBook.
- `token_curve` / `tax_vault` / `duel`: the older object-token path used for app experiments, object-based trading, creator fee vaults, and duel flows. These object tokens cannot trade directly on DeepBook.

## Current Testnet Deployment

- Original package: `0x15f86e205a99a916404ae9cdf64c54b3c03c36274cfa0db757d7308c2fb677de`
- Current v2 package: `0x7bdba89d4f11178ca5c21d93bb6b3825ce14f179c9eb2bb3670a89303ed7b585`
- Arena: `0x338fa3a3b7581a27202fce01944d0607bb1b400e513210707697ea0a1acbb41e`
- UpgradeCap: `0x25ea659c82f219212a7ad910e1a2a8c099f29d0313e5cae69754c7fcb301b48a`
- Sample DeepBook pool: `0x0e7e575c9be015da61ef0ac522ac2494e563e960cd1b30177ae8fdcb7741457e`

Frontend config keeps both package IDs:

- `originalPackageId` is used for object and event type discovery.
- `packageId` is used for current v2 function calls.

## Real DeepBook Launch Flow

DeepBook V3 only trades real `Coin<T>` assets. Sui does not let one already-published package dynamically create arbitrary new `T` types at runtime. For that reason, every project coin that needs real DeepBook graduation must publish its own small Move package with a static witness type.

Use the template in:

```text
templates/deepbook_coin_launch
```

The template package calls:

```move
sui_flap::coin_launch::create_and_share_launch<T>
```

Publishing that package creates:

- shared `CoinCurve<T>`
- shared `CoinTaxVault<T>`
- owned `CoinCreatorCap<T>`
- owned metadata cap

The frontend then follows this order:

1. Refresh launch IDs after the `Coin<T>` package is published.
2. Buy from the `CoinCurve<T>` until the graduation threshold is reached.
3. Create the DeepBook pool for the pair. This costs 500 testnet DEEP.
4. Graduate the launch into DeepBook by depositing liquidity into a BalanceManager and placing the initial maker order.

## Move Package

Main package:

```bash
cd sui_flap
sui move build --allow-dirty
```

Upgrade command:

```bash
sui client upgrade . --upgrade-capability 0x25ea659c82f219212a7ad910e1a2a8c099f29d0313e5cae69754c7fcb301b48a --gas-budget 200000000 --json
```

Template build:

```bash
sui move build --path templates/deepbook_coin_launch --allow-dirty
```

## Frontend

The app is under `web`.

```bash
cd web
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
```

The launchpad UI now exposes the real execution order as a 4-step DeepBook flow. Legacy object-token and duel actions are kept under Advanced actions.

## Module Map

- `coin_launch`: real `Coin<T>` launch, buy/sell, tax vault accounting, graduation asset release
- `sample_coin`: example static coin launch for testing
- `token_curve`: object-token bonding curve prototype
- `tax_vault`: object-token tax routing and fee claims
- `duel`: PvP volume duel prototype
- `deepbook_integrator` / `asset_migration`: coordination metadata for the older object-token prototype
