# DeepBook Coin Launch Template

This template creates a real `Coin<T>` launch that can graduate to DeepBook.

Edit `sources/project_coin.move` before publishing:

- Rename the package, module, and `PROJECT_COIN` type.
- Set the name, symbol, description, Walrus blob ID, graduation threshold, taxes, and pool label.
- Publish the package on testnet after the main `sui_flap` package is upgraded to v2.

Build locally:

```bash
sui move build --path templates/deepbook_coin_launch --allow-dirty
```

Publish from this directory after editing:

```bash
sui client publish . --gas-budget 200000000 --json
```

When the package is published, `init` calls `sui_flap::coin_launch::create_and_share_launch<T>` and creates:

- shared `CoinCurve<T>`
- shared `CoinTaxVault<T>`
- owned `CoinCreatorCap<T>`
- owned metadata cap

The launchpad frontend can discover the curve and vault from `CoinLaunchCreated` events. DeepBook pool creation still costs 500 testnet DEEP for each new coin pair.

Current testnet `sui_flap` package:

- original package: `0x15f86e205a99a916404ae9cdf64c54b3c03c36274cfa0db757d7308c2fb677de`
- v2 package: `0x7bdba89d4f11178ca5c21d93bb6b3825ce14f179c9eb2bb3670a89303ed7b585`
