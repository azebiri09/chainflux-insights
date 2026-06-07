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
  head: () => ({ meta: [{ title: "The Attention Market — ChainFlux" }] }),
});

const STATE_COLORS = {
  low: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", text: "rgba(165,180,252,0.9)", bar: "#818cf8", iconBg: "rgba(99,102,241,0.18)", iconColor: "#a5b4fc" },
  medium: { bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.22)", text: "rgba(253,224,71,0.9)", bar: "#facc15", iconBg: "rgba(234,179,8,0.15)", iconColor: "#fde047" },
  high: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.22)", text: "rgba(110,231,183,0.9)", bar: "#34d399", iconBg: "rgba(16,185,129,0.15)", iconColor: "#6ee7b7" },
};

const STATE_SEGMENT_COLORS: Record<"low" | "medium" | "high", string> = {
  low: "#818cf8",
  medium: "#facc15",
  high: "#34d399",
};

type Explanation = { happening: string; why: string; means: string; action: string; };

const EXPLANATIONS: Record<string, Record<"low" | "medium" | "high", Explanation>> = {
  GAS: {
    low: {
      happening: "Users are competing for block space, pushing transaction costs higher.",
      why: "Increased onchain activity creates more demand for limited block space.",
      means: "Rising gas often reflects heightened network demand, trading activity, or major protocol usage.",
      action: "Watch for volatility. Spikes in gas often appear during periods of high market attention.",
    },
    medium: {
      happening: "Users are competing for block space, pushing transaction costs higher.",
      why: "Increased onchain activity creates more demand for limited block space.",
      means: "Rising gas often reflects heightened network demand, trading activity, or major protocol usage.",
      action: "Watch for volatility. Spikes in gas often appear during periods of high market attention.",
    },
    high: {
      happening: "Users are competing for block space, pushing transaction costs higher.",
      why: "Increased onchain activity creates more demand for limited block space.",
      means: "Rising gas often reflects heightened network demand, trading activity, or major protocol usage.",
      action: "Watch for volatility. Spikes in gas often appear during periods of high market attention.",
    },
  },
  TXS_PER_BLOCK: {
    low: {
      happening: "More transactions are being included in each Ethereum block.",
      why: "Increased usage from users, applications, and protocols is driving higher throughput.",
      means: "Rising transaction counts usually indicate stronger network engagement and activity.",
      action: "Sustained increases may signal growing ecosystem demand.",
    },
    medium: {
      happening: "More transactions are being included in each Ethereum block.",
      why: "Increased usage from users, applications, and protocols is driving higher throughput.",
      means: "Rising transaction counts usually indicate stronger network engagement and activity.",
      action: "Sustained increases may signal growing ecosystem demand.",
    },
    high: {
      happening: "More transactions are being included in each Ethereum block.",
      why: "Increased usage from users, applications, and protocols is driving higher throughput.",
      means: "Rising transaction counts usually indicate stronger network engagement and activity.",
      action: "Sustained increases may signal growing ecosystem demand.",
    },
  },
  ACTIVE_ADDRESSES: {
    low: {
      happening: "More unique wallets are interacting with Ethereum.",
      why: "New and existing participants are becoming more active onchain.",
      means: "Rising address activity is one of the clearest indicators of network adoption.",
      action: "Watch for continued growth. Expanding participation can signal increasing interest across the ecosystem.",
    },
    medium: {
      happening: "More unique wallets are interacting with Ethereum.",
      why: "New and existing participants are becoming more active onchain.",
      means: "Rising address activity is one of the clearest indicators of network adoption.",
      action: "Watch for continued growth. Expanding participation can signal increasing interest across the ecosystem.",
    },
    high: {
      happening: "More unique wallets are interacting with Ethereum.",
      why: "New and existing participants are becoming more active onchain.",
      means: "Rising address activity is one of the clearest indicators of network adoption.",
      action: "Watch for continued growth. Expanding participation can signal increasing interest across the ecosystem.",
    },
  },
};

const ATTENTION_LABELS: Record<string, { color: string; ring: string; label: string; description: string }> = {
  cooling: { color: "#818cf8", ring: "rgba(129,140,248,0.25)", label: "Attention Cooling", description: "Activity is slowing and network demand is easing." },
  rising: { color: "#facc15", ring: "rgba(250,204,21,0.25)", label: "Attention Rising", description: "Participation and usage are increasing across the network." },
  surging: { color: "#f97316", ring: "rgba(249,115,22,0.25)", label: "Attention Surging", description: "Demand is accelerating as more users and capital flow onchain." },
  critical: { color: "#ef4444", ring: "rgba(239,68,68,0.25)", label: "Attention Critical", description: "Network activity is reaching exceptional levels and attention is concentrated across Ethereum." },
};

function getAttentionLevel(score: number): keyof typeof ATTENTION_LABELS {
  if (score <= 30) return "cooling";
  if (score <= 60) return "rising";
  if (score <= 85) return "surging";
  return "critical";
}

function computeAttentionScore(
  gas: number, gasHigh: number, gasLow: number,
  txs: number, txsHigh: number, txsLow: number,
  addr: number, addrHigh: number, addrLow: number
): number {
  const norm = (v: number, lo: number, hi: number) => {
    const range = hi - lo;
    if (range <= 0) return 50;
    return Math.min(100, Math.max(0, ((v - lo) / range) * 100));
  };
  const gasScore = norm(gas, gasLow, gasHigh);
  const txsScore = norm(txs, txsLow, txsHigh);
  const addrScore = norm(addr, addrLow, addrHigh);
  return Math.round(gasScore * 0.4 + txsScore * 0.4 + addrScore * 0.2);
}

function formatValue(metric: string, value: number): string {
  if (value === 0) return "Loading";
  if (metric === "GAS") return value.toFixed(4);
  return Math.round(value).toLocaleString();
}

function StateTag({ state }: { state: "low" | "medium" | "high" }) {
  const labels = { low: "Cooling", medium: "Stable", high: "Surging" };
  const c = STATE_COLORS[state];
  return (
    <span
      className="inline-flex items-center text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full font-bold shrink-0"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {labels[state]}
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

function ExplainCell({ label, text, icon, highlight }: { label: string; text: string; icon: React.ReactNode; highlight?: boolean; }) {
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

function buildNetworkSummary(
  gasState: "low" | "medium" | "high",
  txsState: "low" | "medium" | "high",
  addrState: "low" | "medium" | "high"
): string {
  const gasDesc: Record<"low" | "medium" | "high", string> = {
    low: "Gas fees are low, indicating minimal competition for block space.",
    medium: "Gas fees are at a moderate level, reflecting steady but unremarkable demand for block space.",
    high: "Gas fees are elevated, signaling strong competition for block space and high execution demand.",
  };
  const txsDesc: Record<"low" | "medium" | "high", string> = {
    low: "Block throughput is quiet, with relatively few transactions being processed.",
    medium: "Blocks are processing a steady volume of transactions without any notable congestion.",
    high: "Blocks are filling with a high number of transactions, reflecting intense network usage.",
  };
  const addrDesc: Record<"low" | "medium" | "high", string> = {
    low: "Wallet participation is light, with fewer unique addresses active on the network.",
    medium: "Wallet participation is moderate, with a typical number of addresses transacting.",
    high: "Wallet participation is broad, with a large number of unique addresses active across the network.",
  };

  const allHigh = gasState === "high" && txsState === "high" && addrState === "high";
  const allLow = gasState === "low" && txsState === "low" && addrState === "low";
  const mostlyHigh = [gasState, txsState, addrState].filter(s => s === "high").length >= 2;
  const mostlyLow = [gasState, txsState, addrState].filter(s => s === "low").length >= 2;

  let closing = "";
  if (allHigh) {
    closing = "All three signals are elevated simultaneously, which is a strong indicator of coordinated network demand and broad user activity.";
  } else if (allLow) {
    closing = "The network is quiet across all dimensions with no signs of unusual demand, congestion, or elevated participation.";
  } else if (mostlyHigh) {
    closing = "The majority of network signals are elevated, suggesting broad demand is building even if not every metric is at its peak.";
  } else if (mostlyLow) {
    closing = "Most signals are subdued, pointing to a generally quiet network with limited pressure across gas, throughput, and participation.";
  } else {
    closing = "Signals are mixed across the network, reflecting uneven activity rather than a uniform shift in one direction.";
  }

  return `${gasDesc[gasState]} ${txsDesc[txsState]} ${addrDesc[addrState]} ${closing}`;
}

function ArcBreakdown({
  gasState,
  txsState,
  addrState,
}: {
  gasState: "low" | "medium" | "high";
  txsState: "low" | "medium" | "high";
  addrState: "low" | "medium" | "high";
}) {
  const cx = 60;
  const cy = 60;
  const r = 48;
  const strokeWidth = 10;
  const gap = 0.04;

  // Weights: gas 40%, txs 40%, addr 20%
  // Full circle = 2*PI. Each segment = weight * (2*PI - total_gap)
  const totalGap = gap * 3;
  const total = 2 * Math.PI - totalGap;
  const segments = [
    { label: "Gas", weight: 0.4, state: gasState },
    { label: "TXS", weight: 0.4, state: txsState },
    { label: "Addresses", weight: 0.2, state: addrState },
  ];

  let currentAngle = -Math.PI / 2;

  const arcs = segments.map((seg) => {
    const sweep = seg.weight * total;
    const startAngle = currentAngle + gap / 2;
    const endAngle = startAngle + sweep;
    currentAngle = endAngle + gap / 2;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;

    const color = STATE_SEGMENT_COLORS[seg.state];
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = r + 20;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    return { seg, color, x1, y1, x2, y2, largeArc, lx, ly };
  });

  const summary = buildNetworkSummary(gasState, txsState, addrState);
  const stateLabel: Record<"low" | "medium" | "high", string> = { low: "Cooling", medium: "Stable", high: "Surging" };

  return (
    <div
      className="mt-6 pt-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-start">

        {/* Arc chart */}
        <div className="shrink-0 mx-auto sm:mx-0">
          <svg width={160} height={160} viewBox="0 0 120 120">
            {/* Background track */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
            {arcs.map(({ seg, color, x1, y1, x2, y2, largeArc }) => (
              <path
                key={seg.label}
                d={`M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            ))}
          </svg>
        </div>

        {/* Segment legend */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {arcs.map(({ seg, color }) => (
            <div key={seg.label} className="flex items-center gap-3">
              <div
                className="shrink-0 rounded-full"
                style={{ width: 10, height: 10, background: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/80">{seg.label}</span>
                  <span className="text-[9px] tracking-[0.18em] uppercase text-white/30">{Math.round(seg.weight * 100)}%</span>
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">{stateLabel[seg.state]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Combined network summary */}
      <p className="text-sm leading-relaxed text-white/55 mt-6">
        {summary}
      </p>
    </div>
  );
}

function AttentionScoreCard({
  score,
  gasState,
  txsState,
  addrState,
}: {
  score: number;
  gasState: "low" | "medium" | "high";
  txsState: "low" | "medium" | "high";
  addrState: "low" | "medium" | "high";
}) {
  const [expanded, setExpanded] = useState(false);
  const level = getAttentionLevel(score);
  const info = ATTENTION_LABELS[level];
  const circumference = 2 * Math.PI * 54;
  const filled = (score / 100) * circumference;

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 mb-4 relative overflow-hidden cursor-pointer select-none"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `2px solid ${expanded ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.18)"}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        transition: "border-color 0.2s ease",
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
        <div className="relative w-36 h-36 mx-auto sm:mx-0 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke={info.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold text-white tabular-nums leading-none">{score}</div>
            <div className="text-[9px] tracking-[0.2em] uppercase text-white/30 mt-1">Score</div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-3 font-semibold">Network Attention</div>
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
              <div
                className="absolute rounded-full"
                style={{ width: 18, height: 18, background: info.ring }}
              />
              <div
                className="relative rounded-full"
                style={{ width: 9, height: 9, background: info.color }}
              />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {info.label}
            </div>
          </div>
          <p className="text-white/50 text-sm leading-relaxed mb-4">{info.description}</p>
          <p className="text-white/30 text-xs leading-relaxed">
            A real time measure of activity across Ethereum. Higher scores indicate increasing demand, participation, and network usage.
          </p>
        </div>

        {/* Tap hint */}
        <div
          className="shrink-0 text-white/25 transition-transform duration-300 self-start sm:self-center ml-auto sm:ml-0"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {expanded && (
        <ArcBreakdown gasState={gasState} txsState={txsState} addrState={addrState} />
      )}
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
            <ExplainCell label="What Is Happening" text={explanation.happening} icon={<Pulse size={16} weight="duotone" />} />
          </div>
          <div className="pt-4">
            <ExplainCell label="Why Is This Happening" text={explanation.why} icon={<ChartBar size={16} weight="duotone" />} />
          </div>
          <div className="pt-0 sm:pt-3">
            <ExplainCell label="What Does It Mean" text={explanation.means} icon={<Diamond size={16} weight="duotone" />} />
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

  const gasState = getMetricState("GAS", gas.current);
  const txsState = getMetricState("TXS_PER_BLOCK", txs.current);
  const addrState = getMetricState("ACTIVE_ADDRESSES", feed.ACTIVE_ADDRESSES ?? 0);

  const attentionScore = computeAttentionScore(
    gas.current, feed.GAS_DAILY_HIGH ?? 0, feed.GAS_DAILY_LOW ?? 0,
    txs.current, feed.TXS_DAILY_HIGH ?? 0, feed.TXS_DAILY_LOW ?? 0,
    feed.ACTIVE_ADDRESSES ?? 0, feed.ACTIVE_DAILY_HIGH ?? 0, feed.ACTIVE_DAILY_LOW ?? 0,
  );

  return (
    <Layout>
      <div className="fixed inset-0 pointer-events-none" style={{ background: "#000000" }} />

      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-7xl px-4 sm:px-8">

        <div className="relative mb-12">
          <EthLogo />
          <div className="relative z-10 pr-32 sm:pr-56">
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-4 font-semibold">The Attention Market</div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Live Attention From Ethereum.
            </h1>
            <p className="text-white/40 text-base leading-relaxed max-w-xl">
              Blockchain activity is more than numbers. Every transaction, wallet, and interaction tells a story about where attention is flowing. ChainFlux turns raw activity into signals you can understand at a glance.
            </p>
          </div>
        </div>

        <AttentionScoreCard
          score={attentionScore}
          gasState={gasState}
          txsState={txsState}
          addrState={addrState}
        />

        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="text-[9px] tracking-[0.25em] uppercase text-white/25 font-semibold">Network Demand</div>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>

        <p className="text-white/30 text-sm leading-relaxed mb-6 max-w-xl">
          Is Ethereum becoming busier or quieter? Track the signals that reveal whether network activity is accelerating or slowing down.
        </p>

        <div className="flex flex-col gap-4">
          <FeedRow label="Gas Price" unit="gwei" value={gas.current} metricKey="GAS" dailyHigh={feed.GAS_DAILY_HIGH} dailyLow={feed.GAS_DAILY_LOW} />
          <FeedRow label="Transactions Per Block" unit="txs" value={txs.current} metricKey="TXS_PER_BLOCK" dailyHigh={feed.TXS_DAILY_HIGH} dailyLow={feed.TXS_DAILY_LOW} />
          <FeedRow label="Active Addresses" unit="addresses" value={feed.ACTIVE_ADDRESSES} metricKey="ACTIVE_ADDRESSES" dailyHigh={feed.ACTIVE_DAILY_HIGH} dailyLow={feed.ACTIVE_DAILY_LOW} />
        </div>

      </div>
    </Layout>
  );
}
