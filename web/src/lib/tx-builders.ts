import type { CreateLaunchDraft } from "@/lib/types";
import { CONTRACTS_BY_NETWORK, DEFAULT_NETWORK, type NetworkName } from "@/lib/contracts";

type TxPreview = {
  target: string;
  arguments: string[];
  note: string;
};

function contractTarget(network: NetworkName, moduleName: string, fn: string): string {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return `${contracts.packageId}::${moduleName}::${fn}`;
}

export function buildCreateLaunchPreview(
  draft: CreateLaunchDraft,
  network: NetworkName = DEFAULT_NETWORK,
): TxPreview[] {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return [
    {
      target: contractTarget(network, contracts.moduleNames.tokenCurve, "create_token"),
      arguments: [
        draft.name,
        draft.symbol,
        draft.description,
        draft.walrusBlobId,
        `${draft.virtualSui}`,
        `${draft.virtualToken}`,
        `${draft.basePrice}`,
        `${draft.priceStepBps}`,
        `${draft.graduationThreshold}`,
      ],
      note: "Creates the curve object and creator capability.",
    },
    {
      target: contractTarget(network, contracts.moduleNames.taxVault, "create_vault_for_curve"),
      arguments: [
        "curve_object",
        "creator_cap",
        `${draft.buyTaxBps}`,
        `${draft.sellTaxBps}`,
        `${draft.vaultShareBps}`,
      ],
      note: "Creates the perpetual creator vault for the curve.",
    },
    {
      target: contractTarget(network, contracts.moduleNames.deepbookIntegrator, "create_graduation"),
      arguments: [
        "curve_object",
        "vault_object",
        draft.deepbookPoolLabel ?? `${draft.symbol}/SUI`,
        `deepbook_${draft.deepbookQuoteSymbol ?? "SUI"}`,
        draft.deepbookQuoteSymbol ?? "SUI",
      ],
      note: "Registers the future DeepBook graduation destination for the launch.",
    },
    {
      target: contractTarget(network, contracts.moduleNames.assetMigration, "create_plan"),
      arguments: [
        "curve_object",
        "creator_cap",
        draft.deepbookPoolLabel ?? `${draft.symbol}/SUI`,
        draft.deepbookQuoteSymbol ?? "SUI",
      ],
      note: "Creates the migration plan that will later flip the asset model from object-based to coin-based.",
    },
  ];
}

export function buildBuyPreview(
  curveId: string,
  amountSui: number,
  network: NetworkName = DEFAULT_NETWORK,
): TxPreview {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return {
    target: contractTarget(network, contracts.moduleNames.taxVault, "taxed_buy"),
    arguments: [curveId, "vault_object", `${amountSui}_SUI`, "clock_object"],
    note: "Buys into the curve and returns a LaunchToken object plus change.",
  };
}

export function buildSellPreview(
  curveId: string,
  tokenAmount: number,
  network: NetworkName = DEFAULT_NETWORK,
): TxPreview {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return {
    target: contractTarget(network, contracts.moduleNames.taxVault, "taxed_sell"),
    arguments: [curveId, "vault_object", "launch_token_object", `${tokenAmount}`, "clock_object"],
    note: "Sells LaunchToken balance back into the curve with sell tax applied.",
  };
}

export function buildResolveDuelPreview(
  duelId: number,
  network: NetworkName = DEFAULT_NETWORK,
): TxPreview {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return {
    target: contractTarget(network, contracts.moduleNames.duel, "resolve_duel"),
    arguments: [
      contracts.arenaId,
      `${duelId}`,
      "curve_a",
      "vault_a",
      "curve_b",
      "vault_b",
      "clock_object",
    ],
    note: "Settles the duel and migrates losing reserve into the winner curve.",
  };
}

export function buildDeepbookGraduationPreview(
  poolLabel: string,
  quoteSymbol: string,
  network: NetworkName = DEFAULT_NETWORK,
): TxPreview {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return {
    target: `${contracts.packageId}::${contracts.moduleNames.deepbookIntegrator}::create_graduation`,
    arguments: [poolLabel, `deepbook_${quoteSymbol}`, quoteSymbol],
    note: "Records the DeepBook graduation target that will be activated once the curve graduates.",
  };
}

export function buildCoinLaunchPreview(
  draft: CreateLaunchDraft,
  network: NetworkName = DEFAULT_NETWORK,
): TxPreview[] {
  const contracts = CONTRACTS_BY_NETWORK[network];
  return [
    {
      target: contractTarget(network, contracts.moduleNames.coinLaunch, "create_launch<T>"),
      arguments: [
        "one_time_witness<T>",
        "decimals=9",
        draft.name,
        draft.symbol,
        draft.walrusBlobId,
        `${draft.graduationThreshold}`,
        draft.deepbookPoolLabel ?? `${draft.symbol}/SUI`,
        draft.deepbookQuoteSymbol ?? "SUI",
      ],
      note: "Creates a static Coin<T> launch, stores TreasuryCap<T> inside the curve, and emits DeepBook-ready metadata.",
    },
    {
      target: contractTarget(network, contracts.moduleNames.coinLaunch, "graduate_to_deepbook<T>"),
      arguments: [
        "coin_curve<T>",
        "coin_tax_vault<T>",
        "coin_creator_cap<T>",
        "balance_manager_id",
        "clock_object",
      ],
      note: "After curve graduation, releases Coin<T> base liquidity and SUI quote reserve for the DeepBook SDK PTB.",
    },
  ];
}
