"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { testnetPools } from "@mysten/deepbook-v3";

import { CONTRACTS_BY_NETWORK, DEFAULT_NETWORK } from "@/lib/contracts";
import type { DuelBoardEntry } from "@/lib/types";

type LaunchOverview = {
  id: string;
  symbol: string;
  creator: string;
  walrusBlobId: string;
  deepbookPoolLabel: string;
  deepbookStatus: "planned" | "live";
  assetModel: "object" | "package_queued" | "coin_live";
};

type ArenaOverview = {
  admin: string;
  nextDuelId: string;
  activeDuels: DuelBoardEntry[];
};

function shortId(value: string) {
  if (!value) return "Unassigned";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
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

export function LaunchpadOverview() {
  const client = useCurrentClient();
  const contracts = CONTRACTS_BY_NETWORK[DEFAULT_NETWORK];
  const deepbookPoolCount = useMemo(() => Object.keys(testnetPools).length, []);
  const [launches, setLaunches] = useState<LaunchOverview[]>([]);
  const [arena, setArena] = useState<ArenaOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const launchCreatedEventType = useMemo(
    () => `${contracts.packageId}::${contracts.moduleNames.tokenCurve}::LaunchCreated`,
    [contracts],
  );
  const migrationPlanCreatedEventType = useMemo(
    () => `${contracts.packageId}::${contracts.moduleNames.assetMigration}::MigrationPlanCreated`,
    [contracts],
  );

  useEffect(() => {
    if (!client) return;

    let cancelled = false;

    async function load() {
      setRefreshing(true);
      try {
        const [launchEventResponse, migrationEventResponse, arenaResponse] = await Promise.all([
          client.queryEvents({
            query: { MoveEventType: launchCreatedEventType },
            limit: 20,
            order: "descending",
          }),
          client.queryEvents({
            query: { MoveEventType: migrationPlanCreatedEventType },
            limit: 50,
            order: "descending",
          }),
          client.getObject({
            id: contracts.arenaId,
            options: {
              showContent: true,
            },
          }),
        ]);

        if (cancelled) return;

        const migrationPlans = new Map<string, { poolLabel: string; assetModel: LaunchOverview["assetModel"] }>();
        for (const event of migrationEventResponse.data ?? []) {
          const parsed = event.parsedJson as Record<string, unknown> | undefined;
          if (!parsed) continue;

          const curveId = typeof parsed.curve_id === "string" ? parsed.curve_id : "";
          if (!curveId) continue;

          migrationPlans.set(curveId, {
            poolLabel:
              typeof parsed.preferred_pool_label === "string"
                ? parsed.preferred_pool_label
                : "UNKNOWN/SUI",
            assetModel: "object",
          });
        }

        const nextLaunches = (launchEventResponse.data ?? [])
          .map((event) => {
            const parsed = event.parsedJson as Record<string, unknown> | undefined;
            if (!parsed) return null;

            const symbol = typeof parsed.symbol === "string" ? parsed.symbol : "UNKNOWN";
            const curveId = typeof parsed.curve_id === "string" ? parsed.curve_id : "";
            const migration = migrationPlans.get(curveId);

            const launch: LaunchOverview = {
              id: curveId,
              symbol,
              creator: typeof parsed.creator === "string" ? parsed.creator : "",
              walrusBlobId:
                typeof parsed.walrus_blob_id === "string" ? parsed.walrus_blob_id : "",
              deepbookPoolLabel: migration?.poolLabel ?? `${symbol}/SUI`,
              deepbookStatus: "planned",
              assetModel: migration?.assetModel ?? "object",
            };

            return launch;
          })
          .filter((launch): launch is LaunchOverview => launch !== null && !!launch.id);

        setLaunches(nextLaunches);

        const fields = readMoveFields(arenaResponse.data?.content);
        if (!fields) {
          setArena(null);
          return;
        }

        const activeDuelsRaw = Array.isArray(fields.active_duels) ? fields.active_duels : [];
        const activeDuels = activeDuelsRaw.map((duel) => {
          const duelFields = duel && typeof duel === "object" ? (duel as Record<string, unknown>) : {};
          const inner = duelFields.fields && typeof duelFields.fields === "object"
            ? (duelFields.fields as Record<string, unknown>)
            : duelFields;

          return {
            duelId: Number(readU64(inner.duel_id)),
            tokenA: shortId(readObjectId(inner.token_a)),
            tokenB: shortId(readObjectId(inner.token_b)),
            volumeA: Number(readU64(inner.volume_a)),
            volumeB: Number(readU64(inner.volume_b)),
            endsInMinutes: Math.ceil((Number(readU64(inner.end_time)) - Date.now()) / 60_000),
          } satisfies DuelBoardEntry;
        });

        setArena({
          admin: typeof fields.admin === "string" ? fields.admin : "",
          nextDuelId: readU64(fields.next_duel_id),
          activeDuels,
        });
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [client, contracts.arenaId, launchCreatedEventType, migrationPlanCreatedEventType]);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[32px] border border-stone-300 bg-white/80 p-6 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-orange-700">Launch Board</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
              Testnet launches
            </h2>
            <p className="mt-4 text-base leading-7 text-stone-600">
              Launches discovered from on-chain `LaunchCreated` events, with a default DeepBook graduation route.
            </p>
          </div>
          <span className="rounded-full border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-stone-700">
            {refreshing ? "Refreshing" : `${launches.length} Found`}
          </span>
        </div>

        <div className="mt-7 grid gap-4">
          {launches.length > 0 ? (
            launches.map((launch) => (
              <article key={launch.id} className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{launch.symbol}</p>
                    <p className="mt-2 text-sm font-medium text-stone-900">{shortId(launch.id)}</p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-orange-800">
                    {launch.deepbookStatus === "live" ? "DeepBook Live" : "DeepBook Planned"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-stone-500">Creator {shortId(launch.creator)}</p>
                <p className="mt-2 text-xs text-stone-500">Walrus {launch.walrusBlobId || "Pending"}</p>
                <p className="mt-2 text-xs text-stone-500">DeepBook {launch.deepbookPoolLabel}</p>
                <p className="mt-2 text-xs text-stone-500">Asset Model {launch.assetModel}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-500">No testnet launches found yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-[32px] border border-stone-300 bg-white/80 p-6 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-orange-700">Duel Board</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
              Shared arena snapshot
            </h2>
            <p className="mt-4 text-base leading-7 text-stone-600">
              Current `DuelArena` state from testnet shared object reads.
            </p>
          </div>
          <span className="rounded-full border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-stone-700">
            {deepbookPoolCount} testnet pools
          </span>
        </div>

        <div className="mt-6 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Arena Admin</p>
          <p className="mt-2 text-sm text-stone-900">{arena?.admin ? shortId(arena.admin) : "Unknown"}</p>
        </div>

        <div className="mt-7 overflow-hidden rounded-[26px] border border-stone-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-stone-100 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Duel</th>
                <th className="px-4 py-3 font-medium">A Volume</th>
                <th className="px-4 py-3 font-medium">B Volume</th>
                <th className="px-4 py-3 font-medium">Ends</th>
              </tr>
            </thead>
            <tbody>
              {arena?.activeDuels.length ? (
                arena.activeDuels.map((duel) => (
                  <tr key={duel.duelId} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4 font-medium text-stone-900">
                      #{duel.duelId} {duel.tokenA} / {duel.tokenB}
                    </td>
                    <td className="px-4 py-4 text-stone-700">{duel.volumeA} SUI</td>
                    <td className="px-4 py-4 text-stone-700">{duel.volumeB} SUI</td>
                    <td className="px-4 py-4 text-stone-700">
                      {duel.endsInMinutes <= 0 ? "Ended" : `${duel.endsInMinutes} min`}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-stone-200 bg-white">
                  <td className="px-4 py-4 text-stone-500" colSpan={4}>
                    No active duels on chain yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
