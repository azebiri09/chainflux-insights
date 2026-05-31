import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  if (value === 0) return "Quiet";
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

function StateTag({ state }: { state: "low" | "medium" | "high" }) {
  const colors = {
    low: "rgba(255,255,255,0.12)",
    medium: "rgba(255,255,255,0.12)",
    high: "rgba(255,255,255,0.12)",
  };
  return (
    <span
      className="text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium"
      style={{
        background: colors[state],
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {state}
    </span>
  );
}

function FeedCard({
  metric,
  value,
}: {
  metric: FeedMetric;
  value: number;
}) {
  const [open, setOpen] = useState(false);
  const state = getMetricState(metric, value);
  const explanation = FEED_EXPLANATIONS[metric][state];
  const isQuiet = value === 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer select-none"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(16px)",
      }}
      onClick={() => setOpen((o) => !o)}
    >
      {/* Row — always visible */}
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] tracking-widest uppercase text-white/40 font-medium truncate">
              {FEED_LABELS[metric]}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <StateTag state={state} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div
              className="text-2xl font-semibold tabular-nums tracking-tight"
              style={{ color: isQuiet ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.92)" }}
            >
              {formatValue(metric, value)}
            </div>
            {!isQuiet && (
              <div className="text-[10px] uppercase tracking-widest text-white/25 mt-0.5">
                {FEED_UNITS[metric]}
              </div>
            )}
          </div>

          <div
            className="transition-transform duration-300 text-white/25"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 5L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded explanation */}
      {open && (
        <div
          className="px-5 pb-5 flex flex-col gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="pt-4 flex flex-col gap-4">
            <ExplainRow label="What is happening" text={explanation.happening} />
            <ExplainRow label="Why" text={explanation.why} />
            <ExplainRow label="What it means" text={explanation.means} />
            <ExplainRow label="What to do" text={explanation.action} highlight />
          </div>
        </div>
      )}
    </div>
  );
}

function ExplainRow({
  label,
  text,
  highlight,
}: {
  label: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] tracking-[0.25em] uppercase font-medium text-white/30">
        {label}
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{ color: highlight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.50)" }}
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
      {/* Deep navy background matching app style */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 50% at 50% 0%, rgba(15,25,60,0.8) 0%, rgba(5,8,18,1) 65%)",
        }}
      />

      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-3xl px-5 sm:px-8">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-tight mb-6">
            Live intelligence for the Ethereum network.
          </h1>

          {/* Liquid glass subtitle block */}
          <div
            className="rounded-2xl px-6 py-4"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
            }}
          >
            <p className="text-white/55 text-base leading-relaxed">
              Follow the metrics that drive on-chain activity and uncover shifts before they become obvious.
            </p>
          </div>
        </div>

        {/* Metrics list */}
        <div className="flex flex-col gap-3">
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
