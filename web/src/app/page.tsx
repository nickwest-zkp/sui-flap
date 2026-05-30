import Link from "next/link";

import { BrandHeader } from "@/components/brand-header";
import { DEFAULT_NETWORK } from "@/lib/contracts";

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-stone-300 bg-stone-100/80 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
    </div>
  );
}

function FeatureCard({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-[24px] border border-stone-300 bg-white/80 p-5 shadow-[0_12px_40px_rgba(68,44,14,0.06)]">
      <p className="text-sm font-medium text-stone-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-stone-600">{copy}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.32),_transparent_28%),linear-gradient(180deg,_#f8f5ef_0%,_#efe6d6_100%)] text-stone-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandHeader subtitle="SuiFlap" title="Launchpad, trading, and duel ops for Sui." />
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-sm font-medium text-stone-900"
              href="/launchpad"
            >
              Open Launchpad
            </Link>
            <Link
              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50"
              href="/overview"
            >
              View Overview
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[32px] border border-stone-300/70 bg-[#f6efe1]/90 p-6 shadow-[0_20px_80px_rgba(68,44,14,0.10)] sm:p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-orange-700">
              Network {DEFAULT_NETWORK}
            </p>
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
              SuiFlap keeps launch tools, trading controls, and on-chain discovery separate.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              The landing page now stays short. The actual app lives in its own route, and the
              launch board / duel snapshot can be opened independently when you need them.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard label="Launchpad" value="Dedicated Page" />
              <StatCard label="Discovery" value="Dedicated Page" />
              <StatCard label="Home" value="Short Entry" />
            </div>
          </div>

          <div className="grid gap-4">
            <FeatureCard
              title="Launchpad"
              copy="Create launches, fill runtime IDs, and run buy / sell / duel actions from a focused control surface."
            />
            <FeatureCard
              title="Overview"
              copy="Inspect launches discovered from testnet events and read the shared arena snapshot without the builder UI attached."
            />
            <FeatureCard
              title="Why this split"
              copy="It reduces vertical scrolling and gives each workflow a stable route instead of one oversized page."
            />
          </div>
        </section>
      </div>
    </main>
  );
}
