"use client";

import dynamic from "next/dynamic";

const LaunchpadClient = dynamic(
  () => import("@/components/launchpad-client").then((mod) => mod.LaunchpadClient),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[32px] border border-stone-300 bg-white/85 p-5 shadow-[0_12px_40px_rgba(68,44,14,0.08)] sm:p-6">
        <p className="text-sm text-stone-600">Loading wallet controls...</p>
      </div>
    ),
  },
);

export function LaunchpadClientShell() {
  return <LaunchpadClient />;
}
