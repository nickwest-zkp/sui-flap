export type NetworkName = "localnet" | "testnet" | "mainnet";

export type LaunchpadContracts = {
  originalPackageId: string;
  packageId: string;
  arenaId: string;
  deepbookGraduationId: string;
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
    originalPackageId: "0x838d04c394392dac5226975aa454d587dd416a715fbea15ed264dc607076a0d8",
    packageId: "0x8f79c81510a224cc6ddfebdaf64c867af2e4cb08bcf20a2738b2da90fe913e47",
    arenaId: "0x017b957082a8d04ab9ee2fd6d68410a5f7ee9aad69429687a781761a51a846d0",
    deepbookGraduationId: "0xYOUR_TESTNET_GRADUATION",
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
