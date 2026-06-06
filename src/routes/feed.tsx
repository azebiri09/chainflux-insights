import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { useNetworkFeed, useMarket, getMetricState } from "@/lib/markets";
import {
  Fire,
  ArrowsLeftRight,
  Users,
  Pulse,
  ChartBar,
  Lightning,
  Diamond,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({ meta: [{ title: "Network Feed — ChainFlux" }] }),
});

const STATE_COLORS = {
  low: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", text: "rgba(165,180,252,0.9)", bar: "#818cf8", iconBg: "rgba(99,102,241,0.18)", iconColor: "#a5b4fc" },
  medium: { bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.22)", text: "rgba(253,224,71,0.9)", bar: "#facc15", iconBg: "rgba(234,179,8,0.15)", iconColor: "#fde047" },
  high: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", text: "rgba(110,231,183,0.9)", bar: "#34d399", iconBg: "rgba(16,185,129,0.15)", iconColor: "#6ee7b7" },
};

type Explanation = { happening: string; why: string; means: string; action: string; };

const EXPLANATIONS: Record<string, Record<"low" | "medium" | "high", Explanation>> = {
  GAS: {
    low: { happening: "Gas fees are running below typical levels.", why: "Network demand is light and blocks have spare capacity.", means: "Transactions settle cheaply and quickly.", action: "Good time to execute large or complex on-chain operations." },
    medium: { happening: "Gas is in its normal operating range.", why: "Moderate demand is keeping fees stable.", means: "Conditions are healthy and predictable.", action: "Proceed normally. No urgency to rush or delay." },
    high: { happening: "Gas is elevated. The network is under pressure.", why: "High activity or a surge event is competing for block space.", means: "Transactions cost more and may take longer to confirm.", action: "Batch transactions, delay non-urgent actions, or watch for the spike to pass." },
  },
  TXS_PER_BLOCK: {
    low: { happening: "Transaction throughput is below average.", why: "Activity on Ethereum is quieter than usual.", means: "The market may be in a wait and see phase.", action: "Watch for a pickup in volume as a signal of incoming movement." },
    medium: { happening: "Transaction volume is in a normal range.", why: "Regular user and protocol activity is sustaining baseline throughput.", means: "Ethereum is operating as expected.", action: "No action needed. Use as a baseline for comparison." },
    high: { happening: "Transaction volume is surging.", why: "A high activity event such as a launch, airdrop, or liquidation cascade may be underway.", means: "On-chain momentum is strong. Something significant may be happening.", action: "Investigate the source. High transaction counts often precede price movement." },
  },
  ACTIVE_ADDRESSES: {
    low: { happening: "Barely anyone is transacting on Ethereum right now.", why: "Traders and users are sitting on the sidelines. Nobody wants to make a move yet.", means: "The network is in a quiet phase. Things can flip fast when activity returns.", action: "When addresses start spiking after a quiet period like this, momentum usually follows quickly." },
    medium: { happening: "A decent number of wallets are active on the network right now.", why: "Normal participation across the board. Nothing extreme but the chain is alive and moving.", means: "Standard operating conditions. Liquidity is healthy and the market is functioning well.", action: "No rush. Keep an eye out for a breakout in activity before making any big moves." },
    high: { happening: "A huge wave of wallets just hit the network at the same time.", why: "Something triggered mass participation. Could be a token launch, news event, or bot activity.", means: "The network is in high demand right now. Gas is likely rising and something is moving.", action: "Act fast or wait for things to calm down. High activity like this rarely stays quiet for long." },
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
      className="inline-flex items-center text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full font-bold shrink-0"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {state}
    </span>
  );
}

function MiniChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="w-20 h-8 shrink-0" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80; const h = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const areaPath = `M${pts[0]} L${pts.join(" L")} L${w},${h} L0,${h} Z`;
  const gradId = `grad${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="shrink-0 opacity-75">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={pts.join(" ")} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useRollingValues(value: number, maxLen = 30) {
  const historyRef = useRef<number[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (value === 0) return;
    historyRef.current = [...historyRef.current.slice(-(maxLen - 1)), value];
    setHistory([...historyRef.current]);
  }, [value]);
  return history;
}

function ExplainCell({ label, sublabel, text, icon, highlight }: { label: string; sublabel?: string; text: string; icon: React.ReactNode; highlight?: boolean; }) {
  return (
    <div
      className="flex gap-3 p-4 rounded-xl h-full"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="text-[9px] tracking-[0.22em] uppercase font-semibold text-white/50">{label}</div>
        {sublabel && <div className="text-[9px] tracking-wider uppercase text-white/20 mb-0.5">{sublabel}</div>}
        <div className="text-sm leading-relaxed" style={{ color: highlight ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.48)" }}>
          {text}
        </div>
      </div>
    </div>
  );
}

function EthLogo() {
  return (
    <div className="absolute right-4 sm:right-0 top-0 w-36 h-36 sm:w-52 sm:h-52 pointer-events-none select-none flex items-center justify-center opacity-30">
      <svg viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <polygon points="127.9611,0 125.1661,9.5 125.1661,285.168 127.9611,287.958 255.9231,212.32" fill="rgba(255,255,255,0.6)" />
        <polygon points="127.962,0 0,212.32 127.962,287.959 127.962,154.158" fill="rgba(255,255,255,0.45)" />
        <polygon points="127.9611,312.1866 126.3861,314.1066 126.3861,412.3056 127.9611,416.9066 255.9991,236.5866" fill="rgba(255,255,255,0.55)" />
        <polygon points="127.962,416.9052 127.962,312.1852 0,236.5852" fill="rgba(255,255,255,0.40)" />
        <polygon points="127.9611,287.9577 255.9211,212.3207 127.9611,154.1587" fill="rgba(255,255,255,0.35)" />
        <polygon points="0.0009,212.3207 127.9609,287.9577 127.9609,154.1587" fill="rgba(255,255,255,0.25)" />
      </svg>
    </div>
  );
}

function FeedRow({ label, unit, value, metricKey, dailyHigh, dailyLow }: { label: string; unit: string; value: number; metricKey: string; dailyHigh?: number; dailyLow?: number; }) {
  const [open, setOpen] = useState(false);
  const state = getMetricState(metricKey, value);
  const c = STATE_COLORS[state];
  const explanation = EXPLANATIONS[metricKey]?.[state];
  const history = useRollingValues(value);

  const range = (dailyHigh ?? 0) - (dailyLow ?? 0);
  const position = range > 0 ? ((value - (dailyLow ?? 0)) / range) * 100 : 50;
  const clampedPosition = Math.min(100, Math.max(2, position));

  const metricIcon: Record<string, React.ReactNode> = {
    GAS: <Fire size={20} weight="duotone" />,
    TXS_PER_BLOCK: <ArrowsLeftRight size={20} weight="duotone" />,
    ACTIVE_ADDRESSES: <Users size={20} weight="duotone" />,
  };

  return (
    <div
      className="rounded-2xl w-full overflow-hidden transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `2px solid ${open ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.18)"}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="flex items-center gap-4 px-5 py-6 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: c.iconBg, color: c.iconColor }}
        >
          {metricIcon[metricKey]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-base tracking-tight mb-2 truncate">{label}</div>
          {(dailyHigh ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${clampedPosition}%`, background: `linear-gradient(90deg, #818cf8, ${c.bar})` }}
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

        <MiniChart values={history} color={c.bar} />
        <StateTag state={state} />

        <div className="text-right shrink-0 ml-2">
          <div
            className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight"
            style={{ color: value === 0 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.95)" }}
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
          className="px-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="pt-4">
            <ExplainCell label="What Is Happening?" sublabel="Describe the on-chain activity" text={explanation.happening} icon={<Pulse size={16} weight="duotone" />} />
          </div>
          <div className="pt-4">
            <ExplainCell label="Why Is This Happening?" sublabel="Explain possible causes" text={explanation.why} icon={<ChartBar size={16} weight="duotone" />} />
          </div>
          <div className="pt-0 sm:pt-3">
            <ExplainCell label="What Does It Mean?" sublabel="Significance and market context" text={explanation.means} icon={<Diamond size={16} weight="duotone" />} />
          </div>
          <div className="pt-0 sm:pt-3">
            <ExplainCell label="Possible Reactions" text={explanation.action} icon={<Lightning size={16} weight="duotone" />} highlight />
          </div>
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
      <div className="fixed inset-0 pointer-events-none" style={{ background: "#000000" }} />

      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-7xl px-4 sm:px-8">
        <div className="relative mb-14">
          <EthLogo />
          <div className="relative z-10 pr-32 sm:pr-56">
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Live intelligence for the Ethereum network.
            </h1>
            <p className="text-white/40 text-base leading-relaxed max-w-xl">
              Follow the metrics that drive on-chain activity and uncover shifts before they become obvious.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <FeedRow label="Gas Price" unit="gwei" value={gas.current} metricKey="GAS" dailyHigh={feed.GAS_DAILY_HIGH} dailyLow={feed.GAS_DAILY_LOW} />
          <FeedRow label="Transactions Per Block" unit="txs" value={txs.current} metricKey="TXS_PER_BLOCK" dailyHigh={feed.TXS_DAILY_HIGH} dailyLow={feed.TXS_DAILY_LOW} />
          <FeedRow label="Active Addresses" unit="addresses" value={feed.ACTIVE_ADDRESSES} metricKey="ACTIVE_ADDRESSES" dailyHigh={feed.ACTIVE_DAILY_HIGH} dailyLow={feed.ACTIVE_DAILY_LOW} />
        </div>
      </div>
    </Layout>
  );
           }
