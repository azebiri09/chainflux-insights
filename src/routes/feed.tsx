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
  useMarket,
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

const STATE_COLORS = {
  low: {
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.25)",
    text: "rgba(165,180,252,0.9)",
    dot: "#818cf8",
  },
  medium: {
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.22)",
    text: "rgba(253,224,71,0.9)",
    dot: "#facc15",
  },
  high: {
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.22)",
    text: "rgba(110,231,183,0.9)",
    dot: "#34d399",
  },
};

function formatValue(metric: string, value: number): string {
  if (value === 0) return "Quiet";
  if (metric === "ETH_INTO_AAVE" || metric === "BRIDGE_INFLOWS_OUTFLOWS") {
    return value.toFixed(2);
  }
  if (metric === "STABLES_MINTED_BURNED") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  }
  if (metric === "GAS") return value.toFixed(2);
  if (metric === "TXS_PER_BLOCK") return value.toFixed(1);
  return value.toLocaleString();
}

function StateTag({ state }: { state: "low" | "medium" | "high" }) {
  const c = STATE_COLORS[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full font-semibold shrink-0"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {state}
    </span>
  );
}

function ExplainRow({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] tracking-[0.25em] uppercase font-medium text-white/30">{label}</div>
      <div
        className="text-sm leading-relaxed"
        style={{ color: highlight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.50)" }}
      >
        {text}
      </div>
    </div>
  );
}

function FeedRow({
  label,
  unit,
  value,
  metric,
  explanation,
}: {
  label: string;
  unit: string;
  value: number;
  metric: string;
  explanation: { happening: string; why: string; means: string; action: string };
}) {
  const [open, setOpen] = useState(false);
  const state = getMetricState(metric, value);
  const isQuiet = value === 0;
  const c = STATE_COLORS[state];

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-200"
      style={{
        background: open ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${open ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)"}`,
      }}
      onClick={() => setOpen((o) => !o)}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5">

        {/* State dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: c.dot }}
        />

        {/* Metric name */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm tracking-wide truncate">
            {label}
          </div>
        </div>

        {/* State tag — always visible */}
        <StateTag state={state} />

        {/* Value + unit */}
        <div className="text-right shrink-0 ml-2">
          <div
            className="text-lg sm:text-xl font-semibold tabular-nums tracking-tight"
            style={{ color: isQuiet ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.92)" }}
          >
            {formatValue(metric, value)}
          </div>
          {!isQuiet && (
            <div className="text-[10px] uppercase tracking-widest text-white/25 mt-0.5">{unit}</div>
          )}
        </div>

        {/* Chevron */}
        <div
          className="shrink-0 text-white/25 transition-transform duration-300 ml-1"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div
          className="px-4 sm:px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="pt-5"><ExplainRow label="What is happening" text={explanation.happening} /></div>
          <div className="pt-5"><ExplainRow label="Why" text={explanation.why} /></div>
          <div className="pt-5"><ExplainRow label="What it means" text={explanation.means} /></div>
          <div className="pt-5"><ExplainRow label="What to do" text={explanation.action} highlight /></div>
        </div>
      )}
    </div>
  );
}

const GAS_EXPLANATION = {
  low: {
    happening: "Gas fees are running below typical levels.",
    why: "Network demand is light and blocks have spare capacity.",
    means: "Transactions settle cheaply and quickly.",
    action: "Good time to execute large or complex on-chain operations.",
  },
  medium: {
    happening: "Gas is in its normal operating range.",
    why: "Moderate demand is keeping fees stable.",
    means: "Conditions are healthy and predictable.",
    action: "Proceed normally. No urgency to rush or delay.",
  },
  high: {
    happening: "Gas is elevated. The network is under pressure.",
    why: "High activity or a surge event is competing for block space.",
    means: "Transactions cost more and may take longer to confirm.",
    action: "Batch transactions, delay non-urgent actions, or watch for the spike to pass.",
  },
};

const TXS_EXPLANATION = {
  low: {
    happening: "Transaction throughput is below average.",
    why: "Activity on Ethereum is quieter than usual.",
    means: "The market may be in a wait and see phase.",
    action: "Watch for a pickup in volume as a signal of incoming movement.",
  },
  medium: {
    happening: "Transaction volume is in a normal range.",
    why: "Regular user and protocol activity is sustaining baseline throughput.",
    means: "Ethereum is operating as expected.",
    action: "No action needed. Use as a baseline for comparison.",
  },
  high: {
    happening: "Transaction volume is surging.",
    why: "A high activity event such as a launch, airdrop, or liquidation cascade may be underway.",
    means: "On-chain momentum is strong. Something significant may be happening.",
    action: "Investigate the source. High TXS often precedes price movement.",
  },
};

function FeedPage() {
  const feed = useNetworkFeed();
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");

  const gasState = getMetricState("GAS", gas.current);
  const txsState = getMetricState("TXS_PER_BLOCK", txs.current);

  return (
    <Layout>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 50% at 50% 0%, rgba(15,25,60,0.8) 0%, rgba(5,8,18,1) 65%)",
        }}
      />

      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-tight mb-4">
            Live intelligence for the Ethereum network.
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-2xl">
            Follow the metrics that drive on-chain activity and uncover shifts before they become obvious.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <FeedRow
            label="Gas Price"
            unit="Gwei"
            value={gas.current}
            metric="GAS"
            explanation={GAS_EXPLANATION[gasState]}
          />
          <FeedRow
            label="Transactions Per Block"
            unit="avg txs"
            value={txs.current}
            metric="TXS_PER_BLOCK"
            explanation={TXS_EXPLANATION[txsState]}
          />
          {FEED_METRICS.map((metric) => (
            <FeedRow
              key={metric}
              label={FEED_LABELS[metric]}
              unit={FEED_UNITS[metric]}
              value={feed[metric]}
              metric={metric}
              explanation={FEED_EXPLANATIONS[metric][getMetricState(metric, feed[metric])]}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
        }
