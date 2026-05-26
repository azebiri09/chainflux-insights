import { createFileRoute } from "@tanstack/react-router";
import Layout from "@/components/Layout";
import Sparkline from "@/components/Sparkline";
import { MARKET_UNITS, useAllMarkets } from "@/lib/markets";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({ meta: [{ title: "Network Feed — ChainFlux" }] }),
});

function FeedPage() {
  const all = useAllMarkets();
  return (
    <Layout>
      <div className="pt-24 pb-16 mx-auto max-w-7xl px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Network Feed</h1>
        <p className="mt-3 text-white/60 max-w-2xl">
          A live market for Arbitrum activity. Track GAS, ACTIVITY, and FLOW as the chain moves in real time.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {(["GAS", "ACTIVITY", "FLOW"] as const).map((k) => (
            <div key={k} className="rounded-xl bg-card border border-white/5 p-5">
              <div className="text-xs tracking-widest text-white/50">{k}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-4xl text-white tabular-nums font-semibold">{all[k].current.toFixed(2)}</div>
                <div className="text-xs text-white/40">{MARKET_UNITS[k]}</div>
              </div>
              <div className="mt-4 text-primary/80">
                <Sparkline data={all[k].history} height={180} stroke="oklch(0.75 0.10 245)" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
