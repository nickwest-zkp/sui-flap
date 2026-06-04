# SuiFlap Web

Next.js frontend for the SuiFlap launchpad.

The launchpad page is organized around the real DeepBook execution flow:

1. Refresh launch IDs after a `Coin<T>` launch package is published.
2. Buy from the launch curve until graduation.
3. Create a DeepBook pool. This costs 500 testnet DEEP.
4. Graduate liquidity into DeepBook.

Legacy object-token and duel actions are available under Advanced actions.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run build
```

The testnet contract IDs are configured in `src/lib/contracts.ts`.
