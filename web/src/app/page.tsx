import { LaunchpadClientShell } from "@/components/launchpad-client-shell";
import { LaunchpadOverview } from "@/components/launchpad-overview";
import {
  buildBuyPreview,
  buildCoinLaunchPreview,
  buildDeepbookGraduationPreview,
  buildCreateLaunchPreview,
  buildResolveDuelPreview,
  buildSellPreview,
} from "@/lib/tx-builders";
import { DEFAULT_NETWORK } from "@/lib/contracts";
import { sampleLaunchDraft } from "@/lib/mock-data";

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "hot" | "cool";
}) {
  return (
    <div
      className={`rounded-[28px] border p-5 ${
        tone === "hot"
          ? "border-orange-300 bg-orange-100/80"
          : tone === "cool"
            ? "border-cyan-300 bg-cyan-100/80"
            : "border-stone-300 bg-stone-100/80"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{value}</p>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.28em] text-orange-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-stone-600">{copy}</p>
    </div>
  );
}

export default function Home() {
  const createPreview = buildCreateLaunchPreview(sampleLaunchDraft);
  const buyPreview = buildBuyPreview("curve_object", 25);
  const sellPreview = buildSellPreview("curve_object", 5_000);
  const duelPreview = buildResolveDuelPreview(0);
  const deepbookPreview = buildDeepbookGraduationPreview("WDUEL/SUI", "SUI");
  const coinLaunchPreview = buildCoinLaunchPreview(sampleLaunchDraft);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.32),_transparent_28%),linear-gradient(180deg,_#f8f5ef_0%,_#efe6d6_100%)] text-stone-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-6 sm:px-8 lg:px-10">
        <LaunchpadClientShell />

        <section className="overflow-hidden rounded-[36px] border border-stone-300/70 bg-[#f6efe1]/90 shadow-[0_20px_80px_rgba(68,44,14,0.10)]">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-stone-900 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-stone-50">
                  SuiFlap Control Deck
                </span>
                <span className="rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-orange-800">
                  Network {DEFAULT_NETWORK}
                </span>
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-6xl">
                Creator vaults, curve trading, and PvP liquidation wars on Sui.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
                The contract layer is live as a prototype: launches mint transferable{" "}
                <code className="rounded bg-stone-200 px-2 py-1 text-sm">LaunchToken</code>{" "}
                objects, creator taxes stream into a perpetual vault, and duel resolution
                migrates losing reserve into the winning curve while each launch now records a
                DeepBook graduation target and a future coin-migration plan.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <StatCard label="Status" value="Testnet Live" />
                <StatCard label="Curve Model" value="Object-Based" tone="hot" />
                <StatCard label="Storage" value="Walrus Ready" tone="cool" />
              </div>
            </div>
            <div className="rounded-[30px] border border-stone-300 bg-stone-950 p-6 text-stone-50">
              <p className="text-xs uppercase tracking-[0.24em] text-orange-300">What Works Now</p>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-stone-200">
                <li>Launch creation maps directly to `token_curve::create_token` + `tax_vault::create_vault_for_curve`.</li>
                <li>Buy and sell paths now return real on-chain objects and coins back to the signer wallet.</li>
                <li>Vault claim flow is wired through `claim_vault_funds` with creator-cap matching.</li>
                <li>Duel arena reads are live from testnet, and duel IDs can be filled directly from shared-object state.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-stone-300 bg-white/80 p-6 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-7">
            <SectionTitle
              eyebrow="Launch Flow"
              title="Create a tax-enabled launch in one PTB"
              copy="The control panel above now uses editable form state for create arguments. This preview remains a direct map to the Move calls executed on testnet."
            />
            <div className="mt-8 rounded-[26px] border border-stone-200 bg-stone-950 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Transaction Preview</p>
              <div className="mt-4 space-y-4">
                {createPreview.map((step) => (
                  <div key={step.target} className="rounded-2xl border border-stone-700 bg-stone-900 p-4">
                    <p className="font-mono text-xs text-orange-300">{step.target}</p>
                    <p className="mt-2 text-sm text-stone-200">{step.note}</p>
                    <pre className="mt-3 overflow-x-auto text-xs leading-6 text-stone-400">
                      {step.arguments.join("\n")}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[32px] border border-stone-300 bg-[#13262f] p-6 text-stone-50 shadow-[0_12px_40px_rgba(19,38,47,0.20)] sm:p-7">
              <SectionTitle
                eyebrow="Trade Flow"
                title="Buy and sell against the curve"
                copy="The trading path is object-native. Buys return `LaunchToken` objects, and sells return `Coin<SUI>` back to the signer."
              />
              <div className="mt-7 grid gap-4">
                <div className="rounded-[22px] border border-cyan-900 bg-cyan-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Buy Preview</p>
                  <p className="mt-3 font-mono text-xs text-stone-200">{buyPreview.target}</p>
                  <p className="mt-2 text-sm text-stone-300">{buyPreview.note}</p>
                </div>
                <div className="rounded-[22px] border border-orange-900 bg-orange-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Sell Preview</p>
                  <p className="mt-3 font-mono text-xs text-stone-200">{sellPreview.target}</p>
                  <p className="mt-2 text-sm text-stone-300">{sellPreview.note}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-stone-300 bg-white/80 p-6 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-7">
              <SectionTitle
                eyebrow="Duel Settlement"
                title="Loser reserve now auto-buys the winner"
                copy="Resolve flow remains admin-gated in Move, and the UI above now supports live duel ID filling from the shared arena."
              />
              <div className="mt-6 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs text-stone-700">{duelPreview.target}</p>
                <p className="mt-2 text-sm text-stone-600">{duelPreview.note}</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-stone-300 bg-white/80 p-6 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-7">
              <SectionTitle
                eyebrow="DeepBook Path"
                title="Graduation now has a target market"
                copy="The launchpad is still curve-first, but each launch can now carry a DeepBook-ready destination so the UI and state model stay aligned with the eventual CLOB migration."
              />
              <div className="mt-6 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs text-stone-700">{deepbookPreview.target}</p>
                <p className="mt-2 text-sm text-stone-600">{deepbookPreview.note}</p>
              </div>
              <div className="mt-4 space-y-3">
                {coinLaunchPreview.map((step) => (
                  <div key={step.target} className="rounded-[18px] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs text-stone-700">{step.target}</p>
                    <p className="mt-2 text-sm text-stone-600">{step.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <LaunchpadOverview />
      </div>
    </main>
  );
}
