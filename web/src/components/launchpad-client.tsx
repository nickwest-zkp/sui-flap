"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
  useWalletConnection,
} from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";

import { DEFAULT_NETWORK, CONTRACTS_BY_NETWORK } from "@/lib/contracts";
import { sampleLaunchDraft } from "@/lib/mock-data";
import { createWalrusClient, walrusBinaryFile, walrusJsonFile } from "@/lib/walrus";

type RuntimeIds = {
  creatorRecipient: string;
  curveId: string;
  vaultId: string;
  launchTokenId: string;
  duelId: string;
  curveA: string;
  vaultA: string;
  curveB: string;
  vaultB: string;
};

type LaunchDraftState = {
  name: string;
  symbol: string;
  description: string;
  imageBlobId: string;
  walrusBlobId: string;
  deepbookPoolLabel: string;
  deepbookQuoteSymbol: string;
  virtualSui: string;
  virtualToken: string;
  basePrice: string;
  priceStepBps: string;
  graduationThreshold: string;
  buyTaxBps: string;
  sellTaxBps: string;
  vaultShareBps: string;
};

type OwnedLaunchToken = {
  objectId: string;
  balance: string;
  curveId: string;
};

type OwnedVault = {
  objectId: string;
  curveId: string;
  creatorFeesSui: string;
  buyTaxBps: string;
  sellTaxBps: string;
  vaultShareBps: string;
};

type OwnedCreatorCap = {
  objectId: string;
  curveId: string;
};

type LiveDuelEntry = {
  duelId: string;
  tokenA: string;
  tokenB: string;
  startTime: string;
  endTime: string;
  volumeA: string;
  volumeB: string;
  status: string;
  winner: string;
  loser: string;
};

type ArenaSnapshot = {
  arenaId: string;
  admin: string;
  nextDuelId: string;
  activeDuels: LiveDuelEntry[];
};

type CreatedObjectIds = {
  curveId: string;
  vaultId: string;
  creatorCapId: string;
};

type CreatedObjectChange = {
  objectId: string;
  objectType: string;
  type: "created";
};

function packageReady() {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  return !contracts.packageId.includes("YOUR_") && !contracts.arenaId.includes("YOUR_");
}

function shortId(value: string) {
  if (!value) return "Unassigned";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatRemainingMinutes(endTimeMs: string) {
  const end = Number(endTimeMs);
  if (!Number.isFinite(end) || end <= 0) return "Unknown";

  const deltaMinutes = Math.ceil((end - Date.now()) / 60_000);
  if (deltaMinutes <= 0) return "Ended";
  return `${deltaMinutes}m`;
}

function readMoveFields(content: unknown): Record<string, unknown> | null {
  if (!content || typeof content !== "object") return null;

  const parsed = content as { dataType?: unknown; fields?: unknown };
  if (parsed.dataType !== "moveObject" || !parsed.fields || typeof parsed.fields !== "object") {
    return null;
  }

  return parsed.fields as Record<string, unknown>;
}

function readObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  if (record.id) return readObjectId(record.id);
  if (typeof record.bytes === "string") return record.bytes;
  if (record.fields) return readObjectId(record.fields);

  return "";
}

function readU64(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.value !== undefined) return readU64(record.value);
    if (record.amount !== undefined) return readU64(record.amount);
    if (record.balance !== undefined) return readU64(record.balance);
    if (record.fields !== undefined) return readU64(record.fields);
  }
  return "";
}

function readOptionalObjectId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;

  if ("some" in record) return readObjectId(record.some);
  if ("Some" in record) return readObjectId(record.Some);
  if ("value" in record) return readOptionalObjectId(record.value);
  if ("fields" in record) return readOptionalObjectId(record.fields);
  if ("id" in record || "bytes" in record) return readObjectId(record);

  return "";
}

function readAmountLike(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  if (record.value !== undefined) return readAmountLike(record.value);
  if (record.amount !== undefined) return readAmountLike(record.amount);
  if (record.balance !== undefined) return readAmountLike(record.balance);
  if (record.fields !== undefined) return readAmountLike(record.fields);

  return "";
}

function toU64(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) return BigInt(0);

  try {
    return BigInt(trimmed);
  } catch {
    return BigInt(0);
  }
}

function readAnyFields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (record.dataType === "moveObject" && record.fields && typeof record.fields === "object") {
    return record.fields as Record<string, unknown>;
  }

  if (record.fields && typeof record.fields === "object") {
    return record.fields as Record<string, unknown>;
  }

  return record;
}

function readLiveDuelEntry(value: unknown): LiveDuelEntry | null {
  const fields = readAnyFields(value);
  if (!fields) return null;

  return {
    duelId: readU64(fields.duel_id ?? fields.duelId),
    tokenA: readObjectId(fields.token_a ?? fields.tokenA),
    tokenB: readObjectId(fields.token_b ?? fields.tokenB),
    startTime: readU64(fields.start_time ?? fields.startTime),
    endTime: readU64(fields.end_time ?? fields.endTime),
    volumeA: readU64(fields.volume_a ?? fields.volumeA),
    volumeB: readU64(fields.volume_b ?? fields.volumeB),
    status: readU64(fields.status),
    winner: readOptionalObjectId(fields.winner),
    loser: readOptionalObjectId(fields.loser),
  };
}

function isCreatedObjectChange(value: unknown): value is CreatedObjectChange {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  return (
    record.type === "created" &&
    typeof record.objectId === "string" &&
    typeof record.objectType === "string"
  );
}

function splitGasForAmount(tx: Transaction, amountSui: number) {
  const mist = BigInt(Math.floor(amountSui * 1_000_000_000));
  return tx.splitCoins(tx.gas, [tx.pure.u64(mist)])[0];
}

function buildCreateLaunchTx(runtimeIds: RuntimeIds, draft: LaunchDraftState) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();

  const [curve, creatorCap] = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::create_token`,
    arguments: [
      tx.pure.string(draft.name),
      tx.pure.string(draft.symbol),
      tx.pure.string(draft.description),
      tx.pure.string(draft.walrusBlobId),
      tx.pure.u64(toU64(draft.virtualSui)),
      tx.pure.u64(toU64(draft.virtualToken)),
      tx.pure.u64(toU64(draft.basePrice)),
      tx.pure.u64(toU64(draft.priceStepBps)),
      tx.pure.u64(toU64(draft.graduationThreshold)),
    ],
  });

  const vault = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.taxVault}::create_vault_for_curve`,
    arguments: [
      curve,
      creatorCap,
      tx.pure.u64(toU64(draft.buyTaxBps)),
      tx.pure.u64(toU64(draft.sellTaxBps)),
      tx.pure.u64(toU64(draft.vaultShareBps)),
    ],
  });

  const graduation = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.deepbookIntegrator}::create_graduation`,
    arguments: [
      curve,
      vault,
      tx.pure.string(draft.deepbookPoolLabel),
      tx.pure.string("permissionless_pool"),
      tx.pure.string(draft.deepbookQuoteSymbol),
    ],
  });

  const migrationPlan = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.assetMigration}::create_plan`,
    arguments: [
      curve,
      creatorCap,
      tx.pure.string(draft.deepbookPoolLabel),
      tx.pure.string(draft.deepbookQuoteSymbol),
    ],
  });

  tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::share_curve`,
    arguments: [curve],
  });

  tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.deepbookIntegrator}::share_graduation`,
    arguments: [graduation],
  });

  tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.assetMigration}::share_plan`,
    arguments: [migrationPlan],
  });

  tx.transferObjects([creatorCap, vault], tx.pure.address(runtimeIds.creatorRecipient));
  return tx;
}

function buildBuyTx(curveId: string, vaultId: string, amountSui: number, recipient: string) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();
  const paymentCoin = splitGasForAmount(tx, amountSui);
  const [launchToken, change] = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.taxVault}::taxed_buy`,
    arguments: [
      tx.object(curveId),
      tx.object(vaultId),
      paymentCoin,
      tx.object.clock(),
    ],
  });

  tx.transferObjects([launchToken, change], tx.pure.address(recipient));

  return tx;
}

function buildSellTx(
  curveId: string,
  vaultId: string,
  launchTokenId: string,
  tokenAmount: number,
  recipient: string,
) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();
  const payout = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.taxVault}::taxed_sell`,
    arguments: [
      tx.object(curveId),
      tx.object(vaultId),
      tx.object(launchTokenId),
      tx.pure.u64(tokenAmount),
      tx.object.clock(),
    ],
  });

  tx.transferObjects([payout], tx.pure.address(recipient));

  return tx;
}

function buildResolveDuelTx(runtimeIds: RuntimeIds) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();

  tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.duel}::resolve_duel`,
    arguments: [
      tx.object(contracts.arenaId),
      tx.pure.u64(runtimeIds.duelId),
      tx.object(runtimeIds.curveA),
      tx.object(runtimeIds.vaultA),
      tx.object(runtimeIds.curveB),
      tx.object(runtimeIds.vaultB),
      tx.object.clock(),
    ],
  });

  return tx;
}

function buildEnterDuelTx(curveA: string, curveB: string, durationMs: number) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();

  tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.duel}::enter_duel`,
    arguments: [
      tx.object(contracts.arenaId),
      tx.object(curveA),
      tx.object(curveB),
      tx.object.clock(),
      tx.pure.u64(toU64(String(durationMs))),
    ],
  });

  return tx;
}

function buildBuyInDuelTx(
  duelId: string,
  curveId: string,
  vaultId: string,
  launchTokenId: string,
  amountSui: number,
  recipient: string,
) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();
  const paymentCoin = splitGasForAmount(tx, amountSui);
  const token = launchTokenId
    ? tx.object(launchTokenId)
    : tx.moveCall({
        target: `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::new_zero_token`,
        arguments: [tx.object(curveId)],
      });

  const change = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.duel}::buy_in_duel`,
    arguments: [
      tx.object(contracts.arenaId),
      tx.pure.u64(toU64(duelId)),
      tx.object(curveId),
      tx.object(vaultId),
      token,
      paymentCoin,
      tx.object.clock(),
    ],
  });

  if (!launchTokenId) {
    tx.transferObjects([token], tx.pure.address(recipient));
  }
  tx.transferObjects([change], tx.pure.address(recipient));

  return tx;
}

function buildClaimVaultTx(vaultId: string, creatorCapId: string, recipient: string) {
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const tx = new Transaction();
  const payout = tx.moveCall({
    target: `${contracts.packageId}::${contracts.moduleNames.taxVault}::claim_vault_funds`,
    arguments: [tx.object(vaultId), tx.object(creatorCapId)],
  });

  tx.transferObjects([payout], tx.pure.address(recipient));
  return tx;
}

async function executeTransaction(
  signAndExecute: ReturnType<typeof useDAppKit>["signAndExecuteTransaction"],
  tx: Transaction,
) {
  const result = await signAndExecute({ transaction: tx });

  if ("FailedTransaction" in result && result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
  }

  if (!("Transaction" in result) || !result.Transaction) {
    throw new Error("Wallet did not return a transaction digest.");
  }

  return result.Transaction.digest;
}

export function LaunchpadClient() {
  const dapp = useDAppKit();
  const account = useCurrentAccount();
  const network = useCurrentNetwork();
  const walletConnection = useWalletConnection();
  const client = useCurrentClient();
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const typeNames = useMemo(
    () => ({
      curve: `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::TokenCurve`,
      vault: `${contracts.packageId}::${contracts.moduleNames.taxVault}::TaxVault`,
      creatorCap: `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::CreatorCap`,
      launchToken: `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::LaunchToken`,
    }),
    [contracts],
  );
  const [runtimeIds, setRuntimeIds] = useState<RuntimeIds>({
    creatorRecipient: "",
    curveId: "",
    vaultId: "",
    launchTokenId: "",
    duelId: "",
    curveA: "",
    vaultA: "",
    curveB: "",
    vaultB: "",
  });
  const [launchDraft, setLaunchDraft] = useState<LaunchDraftState>({
    name: sampleLaunchDraft.name,
    symbol: sampleLaunchDraft.symbol,
    description: sampleLaunchDraft.description,
    imageBlobId: "",
    walrusBlobId: sampleLaunchDraft.walrusBlobId,
    deepbookPoolLabel: sampleLaunchDraft.deepbookPoolLabel ?? `${sampleLaunchDraft.symbol}/SUI`,
    deepbookQuoteSymbol: sampleLaunchDraft.deepbookQuoteSymbol ?? "SUI",
    virtualSui: String(sampleLaunchDraft.virtualSui),
    virtualToken: String(sampleLaunchDraft.virtualToken),
    basePrice: String(sampleLaunchDraft.basePrice),
    priceStepBps: String(sampleLaunchDraft.priceStepBps),
    graduationThreshold: String(sampleLaunchDraft.graduationThreshold),
    buyTaxBps: String(sampleLaunchDraft.buyTaxBps),
    sellTaxBps: String(sampleLaunchDraft.sellTaxBps),
    vaultShareBps: String(sampleLaunchDraft.vaultShareBps),
  });

  const [status, setStatus] = useState<string>("Idle");
  const [busy, setBusy] = useState<null | "create" | "buy" | "sell" | "resolve" | "enter" | "duelbuy">(null);
  const [ownedLaunchTokens, setOwnedLaunchTokens] = useState<OwnedLaunchToken[]>([]);
  const [ownedVaults, setOwnedVaults] = useState<OwnedVault[]>([]);
  const [ownedCreatorCaps, setOwnedCreatorCaps] = useState<OwnedCreatorCap[]>([]);
  const [refreshingOwnedObjects, setRefreshingOwnedObjects] = useState(false);
  const [arenaSnapshot, setArenaSnapshot] = useState<ArenaSnapshot | null>(null);
  const [refreshingArena, setRefreshingArena] = useState(false);
  const [claimingVaultId, setClaimingVaultId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingMetadata, setUploadingMetadata] = useState(false);
  const [certifyingMetadata, setCertifyingMetadata] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const walrusMetadataFlowRef = useRef<unknown>(null);

  const chainReady = useMemo(() => packageReady(), []);

  function updateRuntimeId(key: keyof RuntimeIds, value: string) {
    setRuntimeIds((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateLaunchDraft(key: keyof LaunchDraftState, value: string) {
    setLaunchDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function fillResolveIdsFromDuel(duel: LiveDuelEntry) {
    const vaultForA = ownedVaults.find((vault) => vault.curveId === duel.tokenA);
    const vaultForB = ownedVaults.find((vault) => vault.curveId === duel.tokenB);

    setRuntimeIds((current) => ({
      ...current,
      duelId: duel.duelId || current.duelId,
      curveA: duel.tokenA || current.curveA,
      curveB: duel.tokenB || current.curveB,
      vaultA: vaultForA?.objectId || current.vaultA,
      vaultB: vaultForB?.objectId || current.vaultB,
    }));
  }

  function discoverCreatedObjectIds(objectChanges: unknown[] | null | undefined) {
    const created: CreatedObjectIds = {
      curveId: "",
      vaultId: "",
      creatorCapId: "",
    };

    for (const change of objectChanges ?? []) {
      if (!isCreatedObjectChange(change)) continue;

      if (!created.curveId && change.objectType === typeNames.curve) {
        created.curveId = change.objectId;
      } else if (!created.vaultId && change.objectType === typeNames.vault) {
        created.vaultId = change.objectId;
      } else if (!created.creatorCapId && change.objectType === typeNames.creatorCap) {
        created.creatorCapId = change.objectId;
      }
    }

    return created;
  }

  async function refreshOwnedObjects(preferredCurveId?: string) {
    if (!client || !account?.address || !chainReady) {
      setOwnedLaunchTokens([]);
      setOwnedVaults([]);
      setOwnedCreatorCaps([]);
      return;
    }

    setRefreshingOwnedObjects(true);
    try {
      const [launchTokenResponse, vaultResponse, creatorCapResponse] = await Promise.all([
        client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: typeNames.launchToken },
          options: { showContent: true, showType: true },
          limit: 50,
        }),
        client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: typeNames.vault },
          options: { showContent: true, showType: true },
          limit: 50,
        }),
        client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: typeNames.creatorCap },
          options: { showContent: true, showType: true },
          limit: 50,
        }),
      ]);

      const nextLaunchTokens = (launchTokenResponse.data ?? [])
        .map((item) => {
          const object = item.data;
          const fields = readMoveFields(object?.content);
          if (!object?.objectId || !fields) return null;

          return {
            objectId: object.objectId,
            balance: readU64(fields.balance),
            curveId: readObjectId(fields.curve_id),
          } satisfies OwnedLaunchToken;
        })
        .filter((item): item is OwnedLaunchToken => item !== null);

      const nextVaults = (vaultResponse.data ?? [])
        .map((item) => {
          const object = item.data;
          const fields = readMoveFields(object?.content);
          if (!object?.objectId || !fields) return null;

          return {
            objectId: object.objectId,
            curveId: readObjectId(fields.curve_id),
            creatorFeesSui: readAmountLike(fields.creator_fees),
            buyTaxBps: readU64(fields.buy_tax_bps),
            sellTaxBps: readU64(fields.sell_tax_bps),
            vaultShareBps: readU64(fields.vault_percentage_bps),
          } satisfies OwnedVault;
        })
        .filter((item): item is OwnedVault => item !== null);

      const nextCreatorCaps = (creatorCapResponse.data ?? [])
        .map((item) => {
          const object = item.data;
          const fields = readMoveFields(object?.content);
          if (!object?.objectId || !fields) return null;

          return {
            objectId: object.objectId,
            curveId: readObjectId(fields.curve_id),
          } satisfies OwnedCreatorCap;
        })
        .filter((item): item is OwnedCreatorCap => item !== null);

      setOwnedLaunchTokens(nextLaunchTokens);
      setOwnedVaults(nextVaults);
      setOwnedCreatorCaps(nextCreatorCaps);

      setRuntimeIds((current) => {
        const targetCurveId = preferredCurveId || current.curveId;
        const matchingVault =
          nextVaults.find((vault) => vault.curveId === targetCurveId) ??
          (nextVaults.length === 1 ? nextVaults[0] : null);
        const matchingLaunchToken =
          nextLaunchTokens.find((token) => token.curveId === targetCurveId) ??
          (nextLaunchTokens.length === 1 ? nextLaunchTokens[0] : null);

        return {
          ...current,
          vaultId: current.vaultId || matchingVault?.objectId || "",
          launchTokenId: current.launchTokenId || matchingLaunchToken?.objectId || "",
        };
      });
    } finally {
      setRefreshingOwnedObjects(false);
    }
  }

  async function refreshArena() {
    if (!client || !chainReady) {
      setArenaSnapshot(null);
      return;
    }

    setRefreshingArena(true);
    try {
      const response = await client.getObject({
        id: contracts.arenaId,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
        },
      });

      const fields = readMoveFields(response.data?.content);
      if (!response.data?.objectId || !fields) {
        setArenaSnapshot(null);
        return;
      }

      const activeDuelsRaw = Array.isArray(fields.active_duels) ? fields.active_duels : [];
      const activeDuels = activeDuelsRaw
        .map((entry) => readLiveDuelEntry(entry))
        .filter((entry): entry is LiveDuelEntry => entry !== null);

      setArenaSnapshot({
        arenaId: response.data.objectId,
        admin: typeof fields.admin === "string" ? fields.admin : "",
        nextDuelId: readU64(fields.next_duel_id),
        activeDuels,
      });
    } finally {
      setRefreshingArena(false);
    }
  }

  async function hydrateCreateResult(digest: string) {
    const response = await client.getTransactionBlock({
      digest,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
      },
    });

    const created = discoverCreatedObjectIds(response.objectChanges);

    setRuntimeIds((current) => ({
      ...current,
      curveId: created.curveId || current.curveId,
      vaultId: created.vaultId || current.vaultId,
    }));

    await refreshOwnedObjects(created.curveId);

    return created;
  }

  useEffect(() => {
    if (!account?.address) return;

    setRuntimeIds((current) => {
      if (current.creatorRecipient) return current;
      return {
        ...current,
        creatorRecipient: account.address,
      };
    });
  }, [account?.address]);

  useEffect(() => {
    if (!account?.address || !chainReady) {
      setOwnedLaunchTokens([]);
      setOwnedVaults([]);
      setOwnedCreatorCaps([]);
      return;
    }

    void refreshOwnedObjects();
  }, [account?.address, chainReady, client, typeNames.launchToken, typeNames.vault, typeNames.creatorCap]);

  useEffect(() => {
    if (!chainReady) {
      setArenaSnapshot(null);
      return;
    }

    void refreshArena();
  }, [chainReady, client, contracts.arenaId]);

  async function claimVault(vaultId: string, curveId: string) {
    if (!account) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (String(network) !== DEFAULT_NETWORK) {
      setStatus(`Switch the wallet network to ${DEFAULT_NETWORK} before executing.`);
      return;
    }

    const creatorCap = ownedCreatorCaps.find((cap) => cap.curveId === curveId);
    if (!creatorCap) {
      setStatus("No CreatorCap found for this vault in the connected wallet.");
      return;
    }

    try {
      setClaimingVaultId(vaultId);
      setStatus("claim transaction pending signature...");
      const digest = await executeTransaction(
        dapp.signAndExecuteTransaction,
        buildClaimVaultTx(vaultId, creatorCap.objectId, account.address),
      );
      await refreshOwnedObjects(curveId);
      setStatus(`Executed claim. Digest: ${digest}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transaction error";
      setStatus(message);
    } finally {
      setClaimingVaultId(null);
    }
  }

  async function runAction(kind: "create" | "buy" | "sell" | "resolve") {
    if (!account) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (String(network) !== DEFAULT_NETWORK) {
      setStatus(`Switch the wallet network to ${DEFAULT_NETWORK} before executing.`);
      return;
    }

    if (!chainReady) {
      setStatus("Fill real package and object IDs in src/lib/contracts.ts before executing.");
      return;
    }

    try {
      setBusy(kind);
      setStatus(`${kind} transaction pending signature...`);

      let digest = "";
      if (kind === "create") {
        digest = await executeTransaction(
          dapp.signAndExecuteTransaction,
          buildCreateLaunchTx(runtimeIds, launchDraft),
        );
        const created = await hydrateCreateResult(digest);
        setStatus(
          `Executed create. Digest: ${digest}. Curve ${shortId(created.curveId)}. Vault ${shortId(created.vaultId)}.`,
        );
      } else if (kind === "buy") {
        if (!runtimeIds.curveId || !runtimeIds.vaultId) {
          throw new Error("Set curve ID and vault ID before buying.");
        }
        digest = await executeTransaction(
          dapp.signAndExecuteTransaction,
          buildBuyTx(runtimeIds.curveId, runtimeIds.vaultId, 0.02, account.address),
        );
        await refreshOwnedObjects(runtimeIds.curveId);
        setStatus(`Executed buy. Digest: ${digest}`);
      } else if (kind === "sell") {
        if (!runtimeIds.curveId || !runtimeIds.vaultId || !runtimeIds.launchTokenId) {
          throw new Error("Set curve ID, vault ID, and LaunchToken object ID before selling.");
        }
        digest = await executeTransaction(
          dapp.signAndExecuteTransaction,
          buildSellTx(
            runtimeIds.curveId,
            runtimeIds.vaultId,
            runtimeIds.launchTokenId,
            5_000,
            account.address,
          ),
        );
        await refreshOwnedObjects(runtimeIds.curveId);
        setStatus(`Executed sell. Digest: ${digest}`);
      } else {
        if (!runtimeIds.curveA || !runtimeIds.vaultA || !runtimeIds.curveB || !runtimeIds.vaultB) {
          throw new Error("Set curve A/B and vault A/B object IDs before resolving a duel.");
        }
        digest = await executeTransaction(
          dapp.signAndExecuteTransaction,
          buildResolveDuelTx(runtimeIds),
        );
        setStatus(`Executed resolve. Digest: ${digest}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transaction error";
      setStatus(message);
    } finally {
      setBusy(null);
    }
  }

  async function runDuelAction(kind: "enter" | "duelbuy") {
    if (!account) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (String(network) !== DEFAULT_NETWORK) {
      setStatus(`Switch the wallet network to ${DEFAULT_NETWORK} before executing.`);
      return;
    }

    if (kind === "enter") {
      if (!runtimeIds.curveA || !runtimeIds.curveB) {
        setStatus("Set curve A and curve B before entering a duel.");
        return;
      }
    } else if (!runtimeIds.duelId || !runtimeIds.curveId || !runtimeIds.vaultId) {
      setStatus("Set duel ID, curve ID, and vault ID before buying into a duel.");
      return;
    }

    try {
      setBusy(kind);
      setStatus(`${kind} transaction pending signature...`);

      const digest =
        kind === "enter"
          ? await executeTransaction(
              dapp.signAndExecuteTransaction,
              buildEnterDuelTx(runtimeIds.curveA, runtimeIds.curveB, 30 * 60 * 1000),
            )
          : await executeTransaction(
              dapp.signAndExecuteTransaction,
              buildBuyInDuelTx(
                runtimeIds.duelId,
                runtimeIds.curveId,
                runtimeIds.vaultId,
                runtimeIds.launchTokenId,
                0.02,
                account.address,
              ),
            );

      await refreshArena();
      await refreshOwnedObjects(runtimeIds.curveId || undefined);
      setStatus(`Executed ${kind}. Digest: ${digest}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transaction error";
      setStatus(message);
    } finally {
      setBusy(null);
    }
  }

  async function prepareMetadataUploadToWalrus() {
    if (!account) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (String(network) !== DEFAULT_NETWORK) {
      setStatus(`Switch the wallet network to ${DEFAULT_NETWORK} before executing.`);
      return;
    }

    try {
      setUploadingMetadata(true);
      setStatus("Encoding metadata for Walrus...");

      const walrusClient = createWalrusClient();
      const metadataFile = walrusJsonFile(`${launchDraft.symbol || "token"}.json`, {
        name: launchDraft.name,
        symbol: launchDraft.symbol,
        description: launchDraft.description,
        image: launchDraft.imageBlobId ? `walrus://${launchDraft.imageBlobId}` : null,
        attributes: {
          virtualSui: launchDraft.virtualSui,
          virtualToken: launchDraft.virtualToken,
          basePrice: launchDraft.basePrice,
          priceStepBps: launchDraft.priceStepBps,
          graduationThreshold: launchDraft.graduationThreshold,
          buyTaxBps: launchDraft.buyTaxBps,
          sellTaxBps: launchDraft.sellTaxBps,
          vaultShareBps: launchDraft.vaultShareBps,
        },
      });

      const flow = walrusClient.walrus.writeFilesFlow({
        files: [metadataFile],
      });
      walrusMetadataFlowRef.current = flow;

      await flow.encode();
      setStatus("Registering metadata blob on Walrus...");
      const registerTx = flow.register({
        owner: account.address,
        deletable: true,
        epochs: 3,
      });
      const registerDigest = await executeTransaction(dapp.signAndExecuteTransaction, registerTx);

      setStatus("Uploading metadata to Walrus relay...");
      await flow.upload({ digest: registerDigest });
      setStatus("Metadata uploaded to relay. Click Certify Metadata to finalize the Walrus blob.");
    } catch (error) {
      walrusMetadataFlowRef.current = null;
      const message = error instanceof Error ? error.message : "Walrus upload failed";
      setStatus(message);
    } finally {
      setUploadingMetadata(false);
    }
  }

  async function uploadImageToWalrus(file: File) {
    if (!account) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (String(network) !== DEFAULT_NETWORK) {
      setStatus(`Switch the wallet network to ${DEFAULT_NETWORK} before executing.`);
      return;
    }

    try {
      setUploadingImage(true);
      setStatus(`Encoding ${file.name} for Walrus...`);

      const walrusClient = createWalrusClient();
      const imageFile = walrusBinaryFile(
        file.name || `${launchDraft.symbol || "token"}-image`,
        new Uint8Array(await file.arrayBuffer()),
        file.type || "application/octet-stream",
      );

      const flow = walrusClient.walrus.writeFilesFlow({
        files: [imageFile],
      });

      await flow.encode();
      setStatus("Registering image blob on Walrus...");
      const registerTx = flow.register({
        owner: account.address,
        deletable: true,
        epochs: 3,
      });
      const registerDigest = await executeTransaction(dapp.signAndExecuteTransaction, registerTx);

      setStatus("Uploading image to Walrus relay...");
      await flow.upload({ digest: registerDigest });

      setStatus("Certifying image blob on Walrus...");
      const certifyTx = flow.certify();
      await executeTransaction(dapp.signAndExecuteTransaction, certifyTx);

      const files = await flow.listFiles();
      const imageBlobId = files[0]?.blobId ?? "";

      if (!imageBlobId) {
        throw new Error("Walrus image upload completed but no blob ID was returned.");
      }

      updateLaunchDraft("imageBlobId", imageBlobId);
      setStatus(`Image uploaded to Walrus. Blob ID: ${imageBlobId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Walrus image upload failed";
      setStatus(message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function certifyMetadataUploadToWalrus() {
    if (!account) {
      setStatus("Connect a wallet first.");
      return;
    }

    const flow = walrusMetadataFlowRef.current as
      | {
          certify: () => Transaction;
          listFiles: () => Promise<Array<{ blobId: string }>>;
        }
      | null;
    if (!flow) {
      setStatus("No pending metadata upload. Start with Prepare Metadata Upload.");
      return;
    }

    try {
      setCertifyingMetadata(true);
      setStatus("Certifying metadata blob on Walrus...");

      const certifyTx = flow.certify();
      await executeTransaction(dapp.signAndExecuteTransaction, certifyTx);

      const files = await flow.listFiles();
      const metadataBlobId = files[0]?.blobId ?? "";

      if (!metadataBlobId) {
        throw new Error("Walrus certification completed but no metadata blob ID was returned.");
      }

      walrusMetadataFlowRef.current = null;
      updateLaunchDraft("walrusBlobId", metadataBlobId);
      setStatus(`Metadata certified on Walrus. Blob ID: ${metadataBlobId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Walrus certification failed";
      setStatus(message);
    } finally {
      setCertifyingMetadata(false);
    }
  }

  return (
    <div className="rounded-[32px] border border-stone-300 bg-white/85 p-5 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Wallet Control</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            Real Sui transaction path
          </h2>
        </div>
        <ConnectButton>
          <span>Connect Wallet</span>
        </ConnectButton>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Account</p>
          <p className="mt-2 break-all text-sm text-stone-900">{account?.address ?? "Disconnected"}</p>
        </div>
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Network</p>
          <p className="mt-2 text-sm text-stone-900">{String(network)}</p>
        </div>
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Wallet Status</p>
          <p className="mt-2 text-sm text-stone-900">{walletConnection.status}</p>
        </div>
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">RPC</p>
          <p className="mt-2 text-sm text-stone-900">{client ? "Ready" : "Unavailable"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Owned Object Discovery</p>
            <p className="mt-2 text-sm text-stone-800">
              Wallet-owned LaunchTokens, TaxVaults, and CreatorCaps are fetched from testnet and can be
              clicked to fill runtime IDs.
            </p>
          </div>
          <button
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!account || refreshingOwnedObjects}
            onClick={() => void refreshOwnedObjects()}
          >
            {refreshingOwnedObjects ? "Refreshing..." : "Refresh Objects"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <div className="rounded-[18px] border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">LaunchTokens</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ownedLaunchTokens.length > 0 ? (
                ownedLaunchTokens.map((token) => (
                  <button
                    key={token.objectId}
                    className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-xs text-cyan-900"
                    onClick={() => {
                      updateRuntimeId("launchTokenId", token.objectId);
                      if (!runtimeIds.curveId && token.curveId) {
                        updateRuntimeId("curveId", token.curveId);
                      }
                    }}
                    type="button"
                  >
                    {shortId(token.objectId)} | {token.balance || "0"}
                  </button>
                ))
              ) : (
                <p className="text-sm text-stone-500">No LaunchToken objects found for this wallet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">TaxVaults</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ownedVaults.length > 0 ? (
                ownedVaults.map((vault) => (
                  <button
                    key={vault.objectId}
                    className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-left text-xs text-orange-900"
                    onClick={() => {
                      updateRuntimeId("vaultId", vault.objectId);
                      if (!runtimeIds.curveId && vault.curveId) {
                        updateRuntimeId("curveId", vault.curveId);
                      }
                    }}
                    type="button"
                  >
                    {shortId(vault.objectId)} | {shortId(vault.curveId)}
                  </button>
                ))
              ) : (
                <p className="text-sm text-stone-500">No TaxVault objects found for this wallet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">CreatorCaps</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ownedCreatorCaps.length > 0 ? (
                ownedCreatorCaps.map((cap) => (
                  <button
                    key={cap.objectId}
                    className="rounded-full border border-stone-300 bg-stone-100 px-3 py-2 text-left text-xs text-stone-900"
                    onClick={() => {
                      if (!runtimeIds.curveId && cap.curveId) {
                        updateRuntimeId("curveId", cap.curveId);
                      }
                    }}
                    type="button"
                  >
                    {shortId(cap.objectId)} | {shortId(cap.curveId)}
                  </button>
                ))
              ) : (
                <p className="text-sm text-stone-500">No CreatorCap objects found for this wallet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Duel Arena</p>
              <p className="mt-2 text-sm text-stone-800">
                {refreshingArena ? "Refreshing..." : arenaSnapshot ? shortId(arenaSnapshot.arenaId) : "Unavailable"}
              </p>
            </div>
            <button
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={refreshingArena}
              onClick={() => void refreshArena()}
              type="button"
            >
              Refresh Arena
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm text-stone-700">
            <p>Admin: {arenaSnapshot?.admin ? shortId(arenaSnapshot.admin) : "Unknown"}</p>
            <p>Next Duel ID: {arenaSnapshot?.nextDuelId ?? "0"}</p>
            <p>Active Duels: {arenaSnapshot?.activeDuels.length ?? 0}</p>
          </div>
        </div>

        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Vault Claims</p>
              <p className="mt-2 text-sm text-stone-800">Claim creator fees from linked vaults.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {ownedVaults.length > 0 ? (
              ownedVaults.map((vault) => {
                const creatorCap = ownedCreatorCaps.find((cap) => cap.curveId === vault.curveId);
                return (
                  <div key={vault.objectId} className="rounded-[18px] border border-stone-200 bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-stone-900">{shortId(vault.objectId)}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          Curve {shortId(vault.curveId)} | Tax {vault.buyTaxBps}/{vault.sellTaxBps} bps
                        </p>
                      </div>
                      <button
                        className="rounded-full bg-stone-950 px-4 py-2 text-xs font-medium text-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!creatorCap || claimingVaultId === vault.objectId}
                        onClick={() => void claimVault(vault.objectId, vault.curveId)}
                        type="button"
                      >
                        {claimingVaultId === vault.objectId ? "Claiming..." : "Claim Vault"}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-stone-500">
                      Creator fees: {vault.creatorFeesSui || "0"} SUI
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-stone-500">No owned vaults found.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Launch Builder</p>
              <p className="mt-2 text-sm text-stone-800">Editable create parameters for the next launch.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full border border-stone-300 px-4 py-2 text-xs font-medium text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={uploadingMetadata}
                onClick={() => void prepareMetadataUploadToWalrus()}
                type="button"
              >
                {uploadingMetadata ? "Preparing..." : "Prepare Metadata Upload"}
              </button>
              <button
                className="rounded-full border border-stone-300 px-4 py-2 text-xs font-medium text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={certifyingMetadata}
                onClick={() => void certifyMetadataUploadToWalrus()}
                type="button"
              >
                {certifyingMetadata ? "Certifying..." : "Certify Metadata"}
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-[18px] border border-stone-200 bg-white p-4">
            <input
              ref={imageInputRef}
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file) return;

                void uploadImageToWalrus(file).finally(() => {
                  input.value = "";
                });
              }}
              type="file"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Walrus Image Upload</p>
                <p className="mt-2 text-sm text-stone-800">
                  Upload a local token logo to Walrus testnet and auto-fill the image blob field.
                </p>
              </div>
              <button
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                {uploadingImage ? "Uploading..." : "Upload Local Image"}
              </button>
            </div>
            <p className="mt-3 break-all text-xs text-stone-500">
              Current image blob: {launchDraft.imageBlobId || "Not uploaded yet"}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["name", "Name"],
                ["symbol", "Symbol"],
                ["walrusBlobId", "Walrus Blob"],
                ["imageBlobId", "Walrus Image Blob"],
                ["deepbookPoolLabel", "DeepBook Pool"],
                ["deepbookQuoteSymbol", "DeepBook Quote"],
                ["virtualSui", "Virtual SUI"],
                ["virtualToken", "Virtual Token"],
                ["basePrice", "Base Price"],
                ["priceStepBps", "Price Step Bps"],
                ["graduationThreshold", "Graduation Threshold"],
                ["buyTaxBps", "Buy Tax Bps"],
                ["sellTaxBps", "Sell Tax Bps"],
                ["vaultShareBps", "Vault Share Bps"],
              ] as Array<[keyof LaunchDraftState, string]>
            ).map(([key, label]) => (
              <label key={key} className="rounded-[18px] border border-stone-200 bg-white p-3 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
                <input
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
                  value={launchDraft[key]}
                  onChange={(event) => updateLaunchDraft(key, event.target.value)}
                />
              </label>
            ))}
            <label className="rounded-[18px] border border-stone-200 bg-white p-3 text-sm sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Description</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
                value={launchDraft.description}
                onChange={(event) => updateLaunchDraft("description", event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Live Duels</p>
              <p className="mt-2 text-sm text-stone-800">
                Click a duel to fill resolve IDs from the shared arena.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {arenaSnapshot?.activeDuels?.length ? (
              arenaSnapshot.activeDuels.map((duel) => (
                <button
                  key={duel.duelId}
                  className="w-full rounded-[18px] border border-stone-200 bg-white p-4 text-left"
                  onClick={() => fillResolveIdsFromDuel(duel)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-stone-900">Duel #{duel.duelId}</p>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                      {duel.status === "1" ? "Ongoing" : duel.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {shortId(duel.tokenA)} vs {shortId(duel.tokenB)}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    A {duel.volumeA} | B {duel.volumeB} | Ends in {formatRemainingMinutes(duel.endTime)}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-stone-500">No active duels on chain yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(
          [
            ["creatorRecipient", "Creator Recipient"],
            ["curveId", "Curve ID"],
            ["vaultId", "Vault ID"],
            ["launchTokenId", "LaunchToken ID"],
            ["duelId", "Duel ID"],
            ["curveA", "Curve A"],
            ["vaultA", "Vault A"],
            ["curveB", "Curve B"],
            ["vaultB", "Vault B"],
          ] as Array<[keyof RuntimeIds, string]>
        ).map(([key, label]) => (
          <label
            key={key}
            className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 text-sm"
          >
            <span className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
            <input
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
              value={runtimeIds[key]}
              onChange={(event) => updateRuntimeId(key, event.target.value)}
              placeholder={`Enter ${label}`}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <button
          className="rounded-full bg-stone-950 px-4 py-3 text-sm font-medium text-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => runAction("create")}
        >
          {busy === "create" ? "Creating..." : "Create Launch"}
        </button>
        <button
          className="rounded-full bg-orange-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => runAction("buy")}
        >
          {busy === "buy" ? "Buying..." : "Buy 0.02 SUI"}
        </button>
        <button
          className="rounded-full bg-cyan-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => runAction("sell")}
        >
          {busy === "sell" ? "Selling..." : "Sell 5,000"}
        </button>
        <button
          className="rounded-full bg-violet-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => void runDuelAction("enter")}
        >
          {busy === "enter" ? "Entering..." : "Enter Duel"}
        </button>
        <button
          className="rounded-full bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => void runDuelAction("duelbuy")}
        >
          {busy === "duelbuy" ? "Buying..." : "Duel Buy 0.02"}
        </button>
        <button
          className="rounded-full bg-stone-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => runAction("resolve")}
        >
          {busy === "resolve" ? "Resolving..." : "Resolve Duel"}
        </button>
      </div>

      <div className="mt-5 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Execution Status</p>
        <p className="mt-2 text-sm leading-7 text-stone-800">{status}</p>
      </div>
    </div>
  );
}
