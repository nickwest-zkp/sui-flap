export type NetworkName = "localnet" | "testnet" | "mainnet";

export type LaunchpadContracts = {
  originalPackageId: string;
  packageId: string;
  arenaId: string;
  deepbookGraduationId: string;
  deepbookPackageId: string;
  deepbookRegistryId: string;
  deepTreasuryId: string;
  deepCoinType: string;
  sampleDeepbookPoolId: string;
  moduleNames: {
    tokenCurve: string;
    taxVault: string;
    duel: string;
    deepbookIntegrator: string;
    assetMigration: string;
    coinLaunch: string;
    sampleCoin: string;
  };
};

export const CONTRACTS_BY_NETWORK: Record<NetworkName, LaunchpadContracts> = {
  localnet: {
    originalPackageId: "0xYOUR_LOCAL_PACKAGE",
    packageId: "0xYOUR_LOCAL_PACKAGE",
    arenaId: "0xYOUR_LOCAL_ARENA",
    deepbookGraduationId: "0xYOUR_LOCAL_GRADUATION",
    deepbookPackageId: "0xYOUR_LOCAL_DEEPBOOK_PACKAGE",
    deepbookRegistryId: "0xYOUR_LOCAL_DEEPBOOK_REGISTRY",
    deepTreasuryId: "0xYOUR_LOCAL_DEEP_TREASURY",
    deepCoinType: "0xYOUR_LOCAL_DEEP_COIN::deep::DEEP",
    sampleDeepbookPoolId: "0xYOUR_LOCAL_SAMPLE_POOL",
    moduleNames: {
      tokenCurve: "token_curve",
      taxVault: "tax_vault",
      duel: "duel",
      deepbookIntegrator: "deepbook_integrator",
      assetMigration: "asset_migration",
      coinLaunch: "coin_launch",
      sampleCoin: "sample_coin",
    },
  },
  testnet: {
    originalPackageId: "0x15f86e205a99a916404ae9cdf64c54b3c03c36274cfa0db757d7308c2fb677de",
    packageId: "0x7bdba89d4f11178ca5c21d93bb6b3825ce14f179c9eb2bb3670a89303ed7b585",
    arenaId: "0x338fa3a3b7581a27202fce01944d0607bb1b400e513210707697ea0a1acbb41e",
    deepbookGraduationId: "0xYOUR_TESTNET_GRADUATION",
    deepbookPackageId: "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c",
    deepbookRegistryId: "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1",
    deepTreasuryId: "0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb",
    deepCoinType: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
    sampleDeepbookPoolId: "0x0e7e575c9be015da61ef0ac522ac2494e563e960cd1b30177ae8fdcb7741457e",
    moduleNames: {
      tokenCurve: "token_curve",
      taxVault: "tax_vault",
      duel: "duel",
      deepbookIntegrator: "deepbook_integrator",
      assetMigration: "asset_migration",
      coinLaunch: "coin_launch",
      sampleCoin: "sample_coin",
    },
  },
  mainnet: {
    originalPackageId: "0xYOUR_MAINNET_PACKAGE",
    packageId: "0xYOUR_MAINNET_PACKAGE",
    arenaId: "0xYOUR_MAINNET_ARENA",
    deepbookGraduationId: "0xYOUR_MAINNET_GRADUATION",
    deepbookPackageId: "0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748",
    deepbookRegistryId: "0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d",
    deepTreasuryId: "0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe",
    deepCoinType: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    sampleDeepbookPoolId: "0xYOUR_MAINNET_SAMPLE_POOL",
    moduleNames: {
      tokenCurve: "token_curve",
      taxVault: "tax_vault",
      duel: "duel",
      deepbookIntegrator: "deepbook_integrator",
      assetMigration: "asset_migration",
      coinLaunch: "coin_launch",
      sampleCoin: "sample_coin",
    },
  },
};

export const DEFAULT_NETWORK: NetworkName = "testnet";
