import { createFileRoute } from "@tanstack/react-router";
import Layout from "@/components/Layout";
import {
  FEED_LABELS,
  FEED_UNITS,
  FEED_EXPLANATIONS,
  FeedMetric,
  getMetricState,
  useNetworkFeed,
} from "@/lib/markets";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({ meta: [{ title: "Network Feed — ChainFlux" }] }),
});

const FEED_METRICS: FeedMetric[] = [
  "ACTIVE_ADDRESSES",
  "WHALE_TRANSFERS",
  "ETH_INTO_AAVE",
  "LIQUIDATION_VOLUME",
  "STABLES_MINTED_BURNED",
  "NEW_WALLET_CREATION",
  "BRIDGE_INFLOWS_OUTFLOWS",
  "DEX_VOLUME",
];

function formatValue(metric: FeedMetric, value: number): string {
  if (metric === "ETH_INTO_AAVE" || metric === "BRIDGE_INFLOWS_OUTFLOWS") {
    return value.toFixed(2);
  }
  if (metric === "STABLES_MINTED_BURNED") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  }
  return value.toLocaleString();
}

function StateBar({ state }: { state: "low" | "medium" | "high" }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      {["low", "medium", "high"].map((s) => (
        <div
          key={s}
          className="h-1 flex-1 rounded-full transition-all duration-700"
          style={{
            background:
              s === state
                ? state === "high"
                  ? "oklch(0.65 0.20 25)"
                  : state === "medium"
                  ? "oklch(0.78 0.15 85)"
                  : "oklch(0.65 0.15 160)"
                : "rgba(255,255,255,0.08)",
          }}
        />
      ))}
      <span className="text-[10px] tracking-widest uppercase text-white/30 ml-1">
        {state}
      </span>
    </div>
  );
}

function FeedCard({
  metric,
  value,
}: {
  metric: FeedMetric;
  value: number;
}) {
  const state = getMetricState(metric, value);
  const explanation = FEED_EXPLANATIONS[metric][state];

  const glowColor =
    state === "high"
      ? "rgba(239,68,68,0.12)"
      : state === "medium"
      ? "rgba(234,179,8,0.08)"
      : "rgba(59,130,246,0.08)";

  const accentColor =
    state === "high"
      ? "oklch(0.65 0.20 25)"
      : state === "medium"
      ? "oklch(0.78 0.15 85)"
      : "oklch(0.65 0.15 160)";

  return (
    <div
      className="relative rounded-2xl p-7 flex flex-col gap-5 overflow-hidden transition-all duration-700"
      style={{
        background: `linear-gradient(135deg, rgba(10,15,30,0.95) 0%, rgba(15,20,40,0.90) 100%)`,
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: `0 0 40px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Ambient glow blob */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: glowColor,
          filter: "blur(40px)",
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div>
          <div
            className="text-[10px] tracking-[0.3em] uppercase font-medium"
            style={{ color: accentColor }}
          >
            {FEED_LABELS[metric]}
          </div>
          <StateBar state={state} />
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-semibold text-white tabular-nums tracking-tight">
            {formatValue(metric, value)}
          </div>
          <div className="text-xs text-white/30 mt-1 uppercase tracking-widest">
            {FEED_UNITS[metric]}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        className="h-px w-full relative z-10"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />

      {/* AI Explanation */}
      <div className="relative z-10 flex flex-col gap-3">
        <ExplainRow label="What is happening" text={explanation.happening} />
        <ExplainRow label="Why" text={explanation.why} />
        <ExplainRow label="What it means" text={explanation.means} />
        <ExplainRow label="What to do" text={explanation.action} accent={accentColor} />
      </div>
    </div>
  );
}

function ExplainRow({
  label,
  text,
  accent,
}: {
  label: string;
  text: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div
        className="text-[10px] tracking-[0.2em] uppercase font-medium"
        style={{ color: accent ?? "rgba(255,255,255,0.30)" }}
      >
        {label}
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{ color: accent ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)" }}
      >
        {text}
      </div>
    </div>
  );
}

function FeedPage() {
  const feed = useNetworkFeed();

  return (
    <Layout>
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(20,30,70,0.6) 0%, rgba(5,8,20,1) 70%)",
        }}
      />

      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-7xl px-5 sm:px-8">
        {/* Hero */}
        <div className="max-w-2xl mb-16">
          <div
            className="text-[10px] tracking-[0.4em] uppercase font-medium mb-4"
            style={{ color: "oklch(0.78 0.10 245)" }}
          >
            Network Feed
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-tight mb-5">
            The Ethereum pulse. Live.
          </h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Eight live signals from the Ethereum network. Every metric tells you what is happening right now, why it is happening, and what to do next.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid gap-5 sm:grid-cols-2">
          {FEED_METRICS.map((metric) => (
            <FeedCard
              key={metric}
              metric={metric}
              value={feed[metric]}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
  }
