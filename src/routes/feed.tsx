import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Layout from "@/components/Layout";
import { useNetworkFeed, useMarket, getMetricState } from "@/lib/markets";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({ meta: [{ title: "Network Feed — ChainFlux" }] }),
});

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

type Explanation = {
  happening: string;
  why: string;
  means: string;
  action: string;
};

const EXPLANATIONS: Record<string, Record<"low" | "medium" | "high", Explanation>> = {
  GAS: {
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
  },
  TXS_PER_BLOCK: {
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
      action: "Investigate the source. High transaction counts often precede price movement.",
    },
  },
  ACTIVE_ADDRESSES: {
    low: {
      happening: "Barely anyone is transacting on Ethereum right now.",
      why: "Traders and users are sitting on the sidelines. Nobody wants to make a move yet.",
      means: "The network is in a quiet phase. Things can flip fast when activity returns.",
      action: "When addresses start spiking after a quiet period like this, momentum usually follows quickly.",
    },
    medium: {
      happening: "A decent number of wallets are active on the network right now.",
      why: "Normal participation across the board. Nothing extreme but the chain is alive and moving.",
      means: "Standard operating conditions. Liquidity is healthy and the market is functioning well.",
      action: "No rush. Keep an eye out for a breakout in activity before making any big moves.",
    },
    high: {
      happening: "A huge wave of wallets just hit the network at the same time.",
      why: "Something triggered mass participation. Could be a token launch, news event, or bot activity.",
      means: "The network is in high demand right now. Gas is likely rising and something is moving.",
      action: "Act fast or wait for things to calm down. High activity like this rarely stays quiet for long.",
    },
  },
};

function formatValue(metric: string, value: number): string {
  if (value === 0) return "Loading";
  if (metric === "GAS") return value.toFixed(4);
  return Math.round(value).toLocaleString();
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
  metricKey,
  dailyHigh,
  dailyLow,
}: {
  label: string;
  unit: string;
  value: number;
  metricKey: string;
  dailyHigh?: number;
  dailyLow?: number;
}) {
  const [open, setOpen] = useState(false);
  const state = getMetricState(metricKey, value);
  const c = STATE_COLORS[state];
  const explanation = EXPLANATIONS[metricKey]?.[state];

  const range = (dailyHigh ?? 0) - (dailyLow ?? 0);
  const position = range > 0 ? ((value - (dailyLow ?? 0)) / range) * 100 : 50;
  const clampedPosition = Math.min(100, Math.max(2, position));

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-200"
      style={{
        background: open ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${open ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)"}`,
      }}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.dot }} />

        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm tracking-wide truncate">{label}</div>
          {(dailyHigh ?? 0) > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${clampedPosition}%`,
                    background: `linear-gradient(90deg, #818cf8, ${c.dot})`,
                  }}
                />
              </div>
              <span className="text-[9px] text-white/25 tabular-nums shrink-0">
                {metricKey === "GAS"
                  ? `${(dailyLow ?? 0).toFixed(2)} / ${(dailyHigh ?? 0).toFixed(2)}`
                  : `${Math.round(dailyLow ?? 0).toLocaleString()} / ${Math.round(dailyHigh ?? 0).toLocaleString()}`}
              </span>
            </div>
          )}
        </div>

        <StateTag state={state} />

        <div className="text-right shrink-0 ml-2">
          <div
            className="text-lg sm:text-xl font-semibold tabular-nums tracking-tight"
            style={{ color: value === 0 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.92)" }}
          >
            {formatValue(metricKey, value)}
          </div>
          {value > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-white/25 mt-0.5">{unit}</div>
          )}
        </div>

        <div
          className="shrink-0 text-white/25 transition-transform duration-300 ml-1"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {open && explanation && (
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
function FeedPage() {
  const feed = useNetworkFeed();
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");

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
            unit="gwei"
            value={gas.current}
            metricKey="GAS"
            dailyHigh={feed.GAS_DAILY_HIGH}
            dailyLow={feed.GAS_DAILY_LOW}
          />
          <FeedRow
            label="Transactions Per Block"
            unit="txs"
            value={txs.current}
            metricKey="TXS_PER_BLOCK"
            dailyHigh={feed.TXS_DAILY_HIGH}
            dailyLow={feed.TXS_DAILY_LOW}
          />
          <FeedRow
            label="Active Addresses"
            unit="addresses"
            value={feed.ACTIVE_ADDRESSES}
            metricKey="ACTIVE_ADDRESSES"
            dailyHigh={feed.ACTIVE_DAILY_HIGH}
            dailyLow={feed.ACTIVE_DAILY_LOW}
          />
        </div>
      </div>
    </Layout>
  );
}
