export type LaunchTokenSummary = {
  balance: number;
  lots: number;
};

export type Launch = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  walrusBlobId: string;
  creator: string;
  marketCapSui: number;
  raisedSui: number;
  reserveSui: number;
  currentPrice: number;
  virtualSui: number;
  virtualToken: number;
  graduated: boolean;
  taxes: {
    buyBps: number;
    sellBps: number;
    vaultShareBps: number;
    creatorVaultSui: number;
  };
  holder: LaunchTokenSummary;
  deepbook?: {
    ready: boolean;
    poolLabel: string;
    quoteSymbol: string;
    migrationStatus: "curve" | "queued" | "deepbook";
  };
  migration?: {
    assetModel: "object" | "package_queued" | "coin_live";
    packageId?: string;
    balanceManagerId?: string;
  };
  duel?: {
    duelId: number;
    opponentSymbol: string;
    yourSideVolume: number;
    enemySideVolume: number;
    endsInMinutes: number;
  };
};

export type CreateLaunchDraft = {
  name: string;
  symbol: string;
  description: string;
  walrusBlobId: string;
  deepbookPoolLabel?: string;
  deepbookQuoteSymbol?: string;
  virtualSui: number;
  virtualToken: number;
  basePrice: number;
  priceStepBps: number;
  graduationThreshold: number;
  buyTaxBps: number;
  sellTaxBps: number;
  vaultShareBps: number;
};

export type DuelBoardEntry = {
  duelId: number;
  tokenA: string;
  tokenB: string;
  volumeA: number;
  volumeB: number;
  endsInMinutes: number;
};
