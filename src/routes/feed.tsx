import { createFileRoute } from "@tanstack/react-router";
import Layout from "@/components/Layout";
import Sparkline from "@/components/Sparkline";
import { MARKET_LABELS, MARKET_UNITS, useAllMarkets } from "@/lib/markets";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({ meta: [{ title: "Network Feed — ChainFlux" }] }),
});

const COPY: Record<"GAS" | "ACTIVE_ADDRESSES" | "TXS_PER_BLOCK", { title: string; body: string }> = {
  GAS: {
    title: "Network Congestion",
    body: "Arbitrum's base fee moves with demand. When the network gets busy, gas spikes. Trade the direction before it moves.",
  },
  ACTIVE_ADDRESSES: {
    title: "Active Addresses",
    body: "The number of unique addresses active in each block is a raw signal of network participation. Surging addresses means growing activity. Falling means the chain is quiet.",
  },
  TXS_PER_BLOCK: {
    title: "Transactions Per Block",
    body: "Every block tells a story. High tx density means the network is being pushed. Low means quiet. Trade the rhythm of the chain.",
  },
};

function FeedCard({
  k,
  current,
  history,
  size = "wide",
}: {
  k: "GAS" | "ACTIVE_ADDRESSES" | "TXS_PER_BLOCK";
  current: number;
  history: number[];
  size?: "wide" | "tall" | "full";
}) {
  return (
    <div className="glass rounded-2xl p-7 sm:p-9 flex flex-col h-full">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-primary/80 uppercase">{MARKET_LABELS[k]}</div>
          <h3 className="mt-2 text-2xl sm:text-3xl text-white font-semibold tracking-tight">
            {COPY[k].title}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-4xl sm:text-5xl text-white tabular-nums font-semibold">
            {current.toFixed(2)}
          </div>
          <div className="text-xs text-white/40 mt-1 tracking-wider uppercase">{MARKET_UNITS[k]}</div>
        </div>
      </div>
      <p className="mt-6 text-white/65 leading-relaxed text-[15px] max-w-xl">{COPY[k].body}</p>
      <div className="mt-8 text-primary/80 flex-1">
        <Sparkline
          data={history}
          height={size === "full" ? 220 : size === "tall" ? 200 : 160}
          stroke="oklch(0.78 0.10 245)"
        />
      </div>
    </div>
  );
}

function FeedPage() {
  const all = useAllMarkets();
  return (
    <Layout>
      <div className="pt-32 pb-24 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <div className="text-xs tracking-[0.3em] text-primary/80 uppercase">Network Feed</div>
          <h1 className="mt-5 text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.05]">
            The heartbeat, in real time.
          </h1>
          <p className="mt-6 text-white/60 text-lg leading-relaxed">
            A live market for Arbitrum activity. Track GAS, ACTIVE ADDRESSES, and TXS PER BLOCK as the chain moves in real time.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FeedCard k="GAS" current={all.GAS.current} history={all.GAS.history} size="tall" />
          </div>
          <div className="lg:pt-10">
            <FeedCard k="ACTIVE_ADDRESSES" current={all.ACTIVE_ADDRESSES.current} history={all.ACTIVE_ADDRESSES.history} />
          </div>
        </div>

        <div className="mt-10 sm:mt-14">
          <FeedCard k="TXS_PER_BLOCK" current={all.TXS_PER_BLOCK.current} history={all.TXS_PER_BLOCK.history} size="full" />
        </div>
      </div>
    </Layout>
  );
    }
