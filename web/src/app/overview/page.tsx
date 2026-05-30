import Link from "next/link";

import { BrandHeader } from "@/components/brand-header";
import { LaunchpadOverview } from "@/components/launchpad-overview";

export default function OverviewPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_28%),linear-gradient(180deg,_#f8f5ef_0%,_#efe6d6_100%)] text-stone-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <BrandHeader subtitle="Overview" title="Launch and duel snapshot" href="/" />
          <Link
            className="rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-sm font-medium text-stone-900"
            href="/"
          >
            Back Home
          </Link>
        </header>

        <LaunchpadOverview />
      </div>
    </main>
  );
}
