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
  Gauge,
  CurrencyDollar,
  Coin,
  Drop,
  ChartLineUp,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({ meta: [{ title: "The Attention Market — ChainFlux" }] }),
});

const STATE_COLORS = {
  low: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", text: "rgba(165,180,252,1)", bar: "#818cf8", iconBg: "rgba(99,102,241,0.22)", iconColor: "#a5b4fc" },
  medium: { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.35)", text: "rgba(253,224,71,1)", bar: "#facc15", iconBg: "rgba(234,179,8,0.20)", iconColor: "#fde047" },
  high: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", text: "rgba(110,231,183,1)", bar: "#34d399", iconBg: "rgba(16,185,129,0.20)", iconColor: "#6ee7b7" },
};

const STATE_SEGMENT_COLORS: Record<"low" | "medium" | "high", string> = {
  low: "#818cf8",
  medium: "#facc15",
  high: "#34d399",
};

const STATE_GLOW: Record<"low" | "medium" | "high", string> = {
  low: "rgba(129,140,248,0.35)",
  medium: "rgba(250,204,21,0.35)",
  high: "rgba(52,211,153,0.35)",
};

type Explanation = { happening: string; why: string; means: string; action: string; };

const EXPLANATIONS: Record<string, Record<"low" | "medium" | "high", Explanation>> = {
  GAS: {
    low: {
      happening: "Gas fees are low, meaning transactions are cheap and competition for block space is weak.",
      why: "There is limited onchain activity, so users are not bidding aggressively for inclusion.",
      means: "The network is quiet. Demand for execution is soft and users can transact freely without congestion.",
      action: "Good environment for deploying transactions or interacting with apps at low cost. Usually seen during calm market periods.",
    },
    medium: {
      happening: "Gas fees are at a normal level, showing balanced demand for block space.",
      why: "Onchain activity is steady, with no major spikes in usage or congestion.",
      means: "The network is healthy and operating under normal conditions without stress.",
      action: "Neutral conditions. No urgency, but no inactivity either.",
    },
    high: {
      happening: "Gas fees are elevated, meaning users are aggressively competing to get transactions included.",
      why: "High demand from trading, DeFi activity, or protocol events is filling block space quickly.",
      means: "The network is under pressure. Execution is becoming expensive and prioritization is required.",
      action: "Expect higher costs and possible delays. Often appears during strong market moves or hype phases.",
    },
  },
  TXS_PER_BLOCK: {
    low: {
      happening: "Blocks contain fewer transactions than usual.",
      why: "Reduced demand for execution and lower user activity are leaving block space unfilled.",
      means: "Network throughput is light and demand is weak. The chain is underutilized.",
      action: "Quiet market conditions. Low pressure environment with minimal onchain competition.",
    },
    medium: {
      happening: "Blocks are filling at a normal rate.",
      why: "Balanced usage across applications and users is producing steady, healthy throughput.",
      means: "Healthy and stable network operation without congestion or slowdown.",
      action: "Neutral conditions. No congestion risk and no signs of unusual demand.",
    },
    high: {
      happening: "Blocks are heavily packed with transactions.",
      why: "High demand from trading, DeFi usage, or coordinated onchain activity is driving intense throughput.",
      means: "Strong execution pressure and high network usage. The chain is running near capacity.",
      action: "Congestion risk increases. Often seen during high volatility or major market events.",
    },
  },
  ACTIVE_ADDRESSES: {
    low: {
      happening: "Fewer unique wallets are interacting with the network.",
      why: "User participation has slowed and fewer new or returning users are active onchain.",
      means: "Adoption and engagement are cooling. Attention across the ecosystem is low.",
      action: "Watch for stagnation. This often appears before periods of inactivity or consolidation.",
    },
    medium: {
      happening: "A normal number of wallets are active on the network.",
      why: "Regular users and applications are interacting at a steady, expected pace.",
      means: "Healthy baseline engagement. The ecosystem is functioning normally.",
      action: "No strong directional signal. Stability phase with consistent participation.",
    },
    high: {
      happening: "A large number of unique wallets are active across the network.",
      why: "New users, traders, and protocols are driving increased participation across the chain.",
      means: "Strong adoption and rising attention across Ethereum. Engagement is broadly expanding.",
      action: "Momentum is building. Often appears before or during major ecosystem activity.",
    },
  },
  NET_UTILIZATION: {
    low: {
      happening: "Ethereum blocks are running well below their maximum capacity.",
      why: "There is not enough demand to fill blocks, leaving significant unused block space.",
      means: "Low utilization suggests the network is operating with headroom and no congestion pressure exists.",
      action: "Low utilization often precedes quiet trading periods. Watch for sudden demand spikes that can shift this quickly.",
    },
    medium: {
      happening: "Ethereum blocks are filling at a moderate and healthy rate.",
      why: "Demand for block space is balanced, with enough transactions to keep blocks productive without congestion.",
      means: "Moderate utilization is normal network operation. It reflects steady usage without unusual pressure.",
      action: "No immediate action signal. Continue monitoring for a shift toward high utilization which would indicate rising demand.",
    },
    high: {
      happening: "Ethereum blocks are operating near or at full capacity.",
      why: "Demand for block space has outpaced available supply, causing transactions to compete aggressively for inclusion.",
      means: "High utilization drives gas prices up and signals intense network activity. It often coincides with major market events or protocol launches.",
      action: "Expect elevated gas fees and potential delays for lower priority transactions. This is a strong signal of concentrated onchain demand.",
    },
  },
  DEX_VOLUME: {
    low: {
      happening: "Trading activity on decentralized exchanges is quiet.",
      why: "Few users are swapping tokens or interacting with liquidity pools.",
      means: "Speculative interest is low and capital is not actively rotating onchain.",
      action: "Market attention is fading. Often seen during consolidation or low conviction phases.",
    },
    medium: {
      happening: "DEX activity is running at a normal, stable level.",
      why: "Regular trading, arbitrage, and liquidity activity are balanced without unusual spikes.",
      means: "Healthy market participation without strong directional pressure.",
      action: "Neutral trading environment. No strong breakout signal in either direction.",
    },
    high: {
      happening: "DEX volume is sharply elevated across Ethereum.",
      why: "Heavy trading activity, arbitrage flows, or major token events are driving a surge in swaps.",
      means: "Strong speculative engagement and active capital rotation are underway.",
      action: "Momentum is building. Often appears before or during sharp market moves.",
    },
  },
  TVL_CHANGE: {
    low: {
      happening: "Total value locked across Ethereum DeFi protocols is largely unchanged.",
      why: "Capital is not actively entering or leaving DeFi positions in meaningful size.",
      means: "DeFi participation is stable with no strong rotation or withdrawal pressure.",
      action: "Quiet capital environment. Often seen during consolidation phases with low conviction.",
    },
    medium: {
      happening: "DeFi TVL is shifting moderately across Ethereum protocols.",
      why: "Balanced deposits and withdrawals are producing steady but unremarkable capital movement.",
      means: "Normal DeFi activity without unusual inflows or outflows at scale.",
      action: "Neutral signal. Monitor for acceleration in either direction as a leading indicator.",
    },
    high: {
      happening: "A significant amount of capital is moving into or out of Ethereum DeFi.",
      why: "Yield opportunities, risk sentiment shifts, or major protocol events are driving large capital rotations.",
      means: "Strong conviction behavior from DeFi participants. Capital is actively repositioning at scale.",
      action: "Important signal. Large TVL shifts often precede broader market moves and trend formation.",
    },
  },
  STABLECOIN_FLOWS: {
    low: {
      happening: "Stablecoin supply is largely unchanged.",
      why: "Little new capital is entering or exiting the system in stablecoin form.",
      means: "Dry liquidity conditions with limited fresh buying power entering the market.",
      action: "Market may lack fuel for expansion. Watch for rising supply as a leading indicator.",
    },
    medium: {
      happening: "Stablecoin supply is moving moderately.",
      why: "Balanced minting and redemption activity is keeping supply relatively steady.",
      means: "Normal liquidity conditions across Ethereum without unusual capital pressure.",
      action: "Neutral capital environment. A sustained multi-day increase carries more weight than a single move.",
    },
    high: {
      happening: "Stablecoin supply is shifting rapidly.",
      why: "Large inflows or outflows of dollar-denominated capital are occurring onchain.",
      means: "Fresh liquidity is entering or leaving the ecosystem at a meaningful scale.",
      action: "Major signal. Rising supply often precedes increased market activity and price movement.",
    },
  },
  LIQUIDATIONS: {
    low: {
      happening: "Very few positions are being forcibly closed.",
      why: "Price action is stable and not triggering margin thresholds across lending or perp protocols.",
      means: "Low stress environment in leveraged markets with no cascading forced activity.",
      action: "Calm conditions. No forced volatility pressure in either direction.",
    },
    medium: {
      happening: "Some liquidations are occurring across lending and derivatives markets.",
      why: "Normal price fluctuations are triggering isolated position closures without systemic pressure.",
      means: "Typical leveraged market behavior without stress buildup or distress signals.",
      action: "Watch for clustering near key price levels. Isolated liquidations can accelerate if they hit dense zones.",
    },
    high: {
      happening: "A wave of forced liquidations is hitting the market.",
      why: "Sharp price movements are triggering cascading margin calls across lending and perpetual protocols.",
      means: "Market is under stress. Forced selling or buying is amplifying volatility beyond normal ranges.",
      action: "High volatility risk. Moves may accelerate violently in either direction during liquidation cascades.",
    },
  },
};

const ATTENTION_LABELS: Record<string, { color: string; ring: string; label: string; description: string; interpretation: string }> = {
  cooling: {
    color: "#818cf8",
    ring: "rgba(129,140,248,0.30)",
    label: "Dormant Attention",
    description: "Ethereum Attention is a real-time measure of how much activity, capital movement, and execution pressure is flowing through the network. It combines user participation, trading intensity, liquidity shifts, and stress signals into a single view of market behavior. Higher values indicate increasing demand, stronger competition for block space, and elevated sensitivity to market events.",
    interpretation: "The network is quiet with low participation and minimal execution pressure.",
  },
  rising: {
    color: "#facc15",
    ring: "rgba(250,204,21,0.30)",
    label: "Building Attention",
    description: "Ethereum Attention is a real-time measure of how much activity, capital movement, and execution pressure is flowing through the network. It combines user participation, trading intensity, liquidity shifts, and stress signals into a single view of market behavior. Higher values indicate increasing demand, stronger competition for block space, and elevated sensitivity to market events.",
    interpretation: "Activity is increasing steadily as users and capital begin to return to the network.",
  },
  surging: {
    color: "#f97316",
    ring: "rgba(249,115,22,0.30)",
    label: "Intense Attention",
    description: "Ethereum Attention is a real-time measure of how much activity, capital movement, and execution pressure is flowing through the network. It combines user participation, trading intensity, liquidity shifts, and stress signals into a single view of market behavior. Higher values indicate increasing demand, stronger competition for block space, and elevated sensitivity to market events.",
    interpretation: "Strong onchain activity is emerging across multiple layers of the ecosystem.",
  },
  critical: {
    color: "#ef4444",
    ring: "rgba(239,68,68,0.30)",
    label: "Critical Attention",
    description: "Ethereum Attention is a real-time measure of how much activity, capital movement, and execution pressure is flowing through the network. It combines user participation, trading intensity, liquidity shifts, and stress signals into a single view of market behavior. Higher values indicate increasing demand, stronger competition for block space, and elevated sensitivity to market events.",
    interpretation: "The network is under extreme pressure from simultaneous demand and capital movement.",
  },
};

function getAttentionLevel(score: number): keyof typeof ATTENTION_LABELS {
  if (score <= 30) return "cooling";
  if (score <= 60) return "rising";
  if (score <= 85) return "surging";
  return "critical";
}

type MarketPhase = {
  label: string;
  color: string;
  ring: string;
  summary: string;
  interpretation: string;
};

function computeMarketPhase(
  score: number,
  gasState: "low" | "medium" | "high",
  txsState: "low" | "medium" | "high",
  addrState: "low" | "medium" | "high",
  dexState: "low" | "medium" | "high",
  stableState: "low" | "medium" | "high",
  liqState: "low" | "medium" | "high",
  tvlState: "low" | "medium" | "high"
): MarketPhase {
  const stateScore = (s: "low" | "medium" | "high") => s === "high" ? 2 : s === "medium" ? 1 : 0;
  const demandScore = stateScore(gasState) + stateScore(txsState) + stateScore(addrState);
  const liquidityScore = stateScore(dexState) + stateScore(stableState) + stateScore(tvlState);
  const stressScore = stateScore(liqState);

  if (score <= 30) {
    return {
      label: "Quiet Accumulation",
      color: "#818cf8",
      ring: "rgba(129,140,248,0.20)",
      summary: "Network is calm with low activity and limited capital movement.",
      interpretation: "Attention is low. Users are inactive and capital is largely idle. Historically these phases precede expansion when demand returns.",
    };
  }
  if (score <= 60) {
    if (liquidityScore >= demandScore) {
      return {
        label: "Early Expansion",
        color: "#facc15",
        ring: "rgba(250,204,21,0.20)",
        summary: "Liquidity is beginning to rotate as capital starts moving across the ecosystem.",
        interpretation: "Trading and cross-chain flows are picking up before broader user activity follows. This is often an early signal of a developing trend.",
      };
    }
    return {
      label: "Early Expansion",
      color: "#facc15",
      ring: "rgba(250,204,21,0.20)",
      summary: "Activity is building across users and execution layers.",
      interpretation: "More wallets are entering and usage is picking up. This is often the start of a trend formation phase as participation expands.",
    };
  }
  if (score <= 85) {
    if (stressScore >= 2) {
      return {
        label: "Stress Building",
        color: "#f97316",
        ring: "rgba(249,115,22,0.20)",
        summary: "Strong activity is accompanied by rising liquidations and large capital movements.",
        interpretation: "Network demand is high but stress indicators are elevated. Leveraged positions are under pressure and forced flows may amplify volatility.",
      };
    }
    return {
      label: "High Activity Phase",
      color: "#f97316",
      ring: "rgba(249,115,22,0.20)",
      summary: "Strong onchain demand across multiple signals.",
      interpretation: "Network participation is elevated. Liquidity, trading, and execution demand are all active. The chain is operating under meaningful pressure.",
    };
  }
  return {
    label: "Overheat Zone",
    color: "#ef4444",
    ring: "rgba(239,68,68,0.20)",
    summary: "Extreme pressure across execution and capital flows.",
    interpretation: "Congestion, liquidation risk, and aggressive capital rotation are all elevated simultaneously. Volatility risk is at its highest and moves can accelerate rapidly.",
  };
}

function computeAttentionScore(signals: {
  gas: number; gasHigh: number; gasLow: number;
  txs: number; txsHigh: number; txsLow: number;
  addr: number; addrHigh: number; addrLow: number;
  util: number;
  dex: number; dexHigh: number; dexLow: number;
  tvl: number; tvlHigh: number; tvlLow: number;
  stable: number; stableHigh: number; stableLow: number;
  liq: number; liqHigh: number; liqLow: number;
}): number {
  const norm = (v: number, lo: number, hi: number) => {
    const range = hi - lo;
    if (range <= 0) return 50;
    return Math.min(100, Math.max(0, ((v - lo) / range) * 100));
  };
  const s = signals;
  return Math.round(
    norm(s.gas, s.gasLow, s.gasHigh) * 0.20 +
    norm(s.txs, s.txsLow, s.txsHigh) * 0.20 +
    norm(s.addr, s.addrLow, s.addrHigh) * 0.10 +
    s.util * 0.15 +
    norm(s.dex, s.dexLow, s.dexHigh) * 0.10 +
    norm(s.tvl, s.tvlLow, s.tvlHigh) * 0.10 +
    norm(s.stable, s.stableLow, s.stableHigh) * 0.05 +
    norm(s.liq, s.liqLow, s.liqHigh) * 0.10
  );
}

function getSimpleMetricState(value: number, low: number, high: number): "low" | "medium" | "high" {
  if (low === 0 && high === 0) return "medium";
  const range = high - low;
  if (range <= 0) return "medium";
  const pct = (value - low) / range;
  if (pct < 0.33) return "low";
  if (pct < 0.67) return "medium";
  return "high";
}

function getUtilizationState(value: number): "low" | "medium" | "high" {
  if (value < 33) return "low";
  if (value < 67) return "medium";
  return "high";
}

function formatValue(metric: string, value: number, extraData?: { tvlValue?: number }): string {
  if (metric === "TVL_CHANGE") {
    const tvlValue = extraData?.tvlValue ?? 0;
    if (tvlValue === 0 && value === 0) return "Loading";
    const sign = value >= 0 ? "+" : "";
    const pct = `${sign}${value.toFixed(2)}%`;
    if (tvlValue >= 1e9) return `$${(tvlValue / 1e9).toFixed(2)}B ${pct}`;
    if (tvlValue >= 1e6) return `$${(tvlValue / 1e6).toFixed(1)}M ${pct}`;
    return `$${tvlValue.toFixed(0)} ${pct}`;
  }
  if (value === 0) return "Loading";
  if (metric === "GAS") return value.toFixed(4);
  if (metric === "NET_UTILIZATION") return `${value.toFixed(1)}%`;
  if (
    metric === "DEX_VOLUME" ||
    metric === "STABLECOIN_FLOWS" || metric === "LIQUIDATIONS"
  ) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
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

function TradeableBadge() {
  return (
    <span
      className="inline-flex items-center text-[8px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full font-bold shrink-0"
      style={{
        background: "rgba(52,211,153,0.10)",
        border: "1px solid rgba(52,211,153,0.30)",
        color: "#6ee7b7",
      }}
    >
      Tradeable
    </span>
  );
}

function MiniChart({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return <div className="w-16 h-8" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64, h = 32, pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function ExplainCell({ label, text, icon, highlight }: { label: string; text: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: highlight ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "rgba(255,255,255,0.35)" }}>{icon}</span>
        <span className="text-[9px] tracking-[0.2em] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.40)" }}>{label}</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.70)" }}>{text}</p>
    </div>
  );
}

function EthLogo() {
  return (
    <div className="absolute top-0 right-0 pointer-events-none select-none" style={{ opacity: 0.06 }}>
      <svg width="180" height="180" viewBox="0 0 256 417" fill="white">
        <path d="M127.9 0L125 9.5V285l2.9 2.9 127.9-75.6z" />
        <path d="M127.9 0L0 212.3l127.9 75.6V0z" opacity=".6" />
        <path d="M127.9 311.5l-1.6 1.9v100l1.6 4.6 128-180.3z" />
        <path d="M127.9 417V311.5L0 237.7z" opacity=".6" />
        <path d="M127.9 287.9L255.8 212.3 127.9 155.5z" opacity=".2" />
        <path d="M0 212.3l127.9 75.6V155.5z" opacity=".6" />
      </svg>
    </div>
  );
}

function AttentionScoreCard({
  score,
  gasState, txsState, addrState,
  gasValue, txsValue, addrValue,
  utilState, utilValue,
  dexState, dexValue,
  tvlState, tvlValue, tvlChangeValue,
  stableState, stableValue,
  liqState, liqValue,
}: {
  score: number;
  gasState: "low" | "medium" | "high"; txsState: "low" | "medium" | "high"; addrState: "low" | "medium" | "high";
  gasValue: number; txsValue: number; addrValue: number;
  utilState: "low" | "medium" | "high"; utilValue: number;
  dexState: "low" | "medium" | "high"; dexValue: number;
  tvlState: "low" | "medium" | "high"; tvlValue: number; tvlChangeValue: number;
  stableState: "low" | "medium" | "high"; stableValue: number;
  liqState: "low" | "medium" | "high"; liqValue: number;
}) {
  const [open, setOpen] = useState(false);
  const level = getAttentionLevel(score);
  const info = ATTENTION_LABELS[level];
  const phase = computeMarketPhase(score, gasState, txsState, addrState, dexState, stableState, liqState, tvlState);

  const SIGNALS = [
    { label: "Gas Price", weight: "20%", state: gasState, value: gasValue, format: (v: number) => `${v.toFixed(2)} gwei` },
    { label: "Transactions Per Block", weight: "20%", state: txsState, value: txsValue, format: (v: number) => `${Math.round(v)} txs` },
    { label: "Active Addresses", weight: "10%", state: addrState, value: addrValue, format: (v: number) => `${Math.round(v).toLocaleString()}` },
    { label: "Network Utilization", weight: "15%", state: utilState, value: utilValue, format: (v: number) => `${v.toFixed(1)}%` },
    { label: "DEX Volume", weight: "10%", state: dexState, value: dexValue, format: (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toFixed(0)}` },
    { label: "DeFi TVL Change", weight: "10%", state: tvlState, value: tvlChangeValue, format: (v: number) => { const sign = v >= 0 ? "+" : ""; return `${sign}${v.toFixed(2)}%`; } },
    { label: "Stablecoin Flows", weight: "5%", state: stableState, value: stableValue, format: (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toFixed(0)}` },
    { label: "Liquidations", weight: "10%", state: liqState, value: liqValue, format: (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K` },
  ];

  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (score / 100) * circumference;

  // Refined professional palette — muted, no neon, no glow.
  const REFINED: Record<"low" | "medium" | "high", { stroke: string; chipBg: string; chipBorder: string; chipText: string; label: string }> = {
    low:    { stroke: "rgba(148,163,184,0.85)", chipBg: "rgba(148,163,184,0.08)", chipBorder: "rgba(148,163,184,0.28)", chipText: "rgba(203,213,225,0.95)", label: "Cooling" },
    medium: { stroke: "rgba(180,168,140,0.85)", chipBg: "rgba(180,168,140,0.08)", chipBorder: "rgba(180,168,140,0.28)", chipText: "rgba(215,205,180,0.95)", label: "Stable" },
    high:   { stroke: "rgba(143,176,158,0.90)", chipBg: "rgba(143,176,158,0.08)", chipBorder: "rgba(143,176,158,0.30)", chipText: "rgba(196,219,206,0.95)", label: "Surging" },
  };
  const weights = [20, 20, 10, 15, 10, 10, 5, 10];
  const donutR = 80;
  const donutC = 2 * Math.PI * donutR;
  let acc = 0;

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 mb-2 cursor-pointer select-none transition-colors"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.10)" }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>Ethereum Attention State</div>
      <div className="flex items-start gap-6 sm:gap-10">
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.95)" }}>{score}</div>
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>score</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl sm:text-2xl font-semibold mb-1" style={{ color: "rgba(255,255,255,0.95)" }}>{info.label}</div>
          <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.60)" }}>{info.interpretation}</p>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium tracking-wide uppercase"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}
          >
            {phase.label}
          </div>
        </div>
        <div
          className="shrink-0 transition-transform duration-300 mt-1"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.40)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="mt-8 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Large centered segmented donut */}
          <div className="flex flex-col items-center">
            <div className="relative" style={{ width: 220, height: 220 }}>
              <svg width="220" height="220" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r={donutR} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
                {SIGNALS.map((sig, i) => {
                  const w = weights[i];
                  const segLen = (w / 100) * donutC;
                  const gap = 2;
                  const dash = `${Math.max(0, segLen - gap)} ${donutC}`;
                  const rot = -90 + (acc / 100) * 360;
                  acc += w;
                  return (
                    <circle
                      key={sig.label}
                      cx="110" cy="110" r={donutR}
                      fill="none"
                      stroke={REFINED[sig.state].stroke}
                      strokeWidth="14"
                      strokeDasharray={dash}
                      transform={`rotate(${rot} 110 110)`}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.95)" }}>{score}</div>
                <div className="text-[9px] uppercase tracking-[0.25em] mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>Attention</div>
              </div>
            </div>

            {/* Legend row */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {(["low","medium","high"] as const).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-[3px] rounded-full" style={{ background: REFINED[s].stroke }} />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{REFINED[s].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signal rows */}
          <div className="mt-8">
            <div className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-3" style={{ color: "rgba(255,255,255,0.40)" }}>Signal Breakdown</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SIGNALS.map((sig) => {
                const r = REFINED[sig.state];
                return (
                  <div
                    key={sig.label}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-block w-[3px] h-5 rounded-full shrink-0" style={{ background: r.stroke }} />
                      <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{sig.label}</span>
                      <span className="text-[9px] shrink-0 tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>{sig.weight}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>{sig.format(sig.value)}</span>
                      <span
                        className="text-[9px] tracking-[0.15em] uppercase font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: r.chipBg, color: r.chipText, border: `1px solid ${r.chipBorder}` }}
                      >
                        {r.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Network summary */}
          <div className="mt-6 p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>Network Summary</div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.70)" }}>{phase.interpretation}</p>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{info.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedRow({
  label, unit, value, metricKey, dailyHigh, dailyLow, tradeable, tvlValue,
}: {
  label: string; unit: string; value: number | undefined; metricKey: string;
  dailyHigh?: number; dailyLow?: number; tradeable?: boolean; tvlValue?: number;
}) {
  const [open, setOpen] = useState(false);
  const feedData = useNetworkFeed();
  const history: number[] = (feedData as any)[`${metricKey}_HISTORY`] ?? [];

  const safeValue = value ?? 0;
  let state: "low" | "medium" | "high" = "medium";
  if (metricKey === "GAS") state = getMetricState("GAS", safeValue);
  else if (metricKey === "TXS_PER_BLOCK") state = getMetricState("TXS_PER_BLOCK", safeValue);
  else if (metricKey === "ACTIVE_ADDRESSES") state = getMetricState("ACTIVE_ADDRESSES", safeValue);
  else if (metricKey === "NET_UTILIZATION") state = getUtilizationState(safeValue);
  else state = getSimpleMetricState(safeValue, dailyLow ?? 0, dailyHigh ?? 1);

  const c = STATE_COLORS[state];
  const explanation = EXPLANATIONS[metricKey]?.[state];

  const barPct = metricKey === "NET_UTILIZATION"
    ? Math.min(100, safeValue)
    : (dailyHigh ?? 0) > (dailyLow ?? 0)
      ? Math.min(100, Math.max(0, ((safeValue - (dailyLow ?? 0)) / ((dailyHigh ?? 1) - (dailyLow ?? 0))) * 100))
      : 50;

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-200"
      style={{ background: open ? c.bg : "rgba(255,255,255,0.03)", border: `2px solid ${open ? c.border : "rgba(255,255,255,0.18)"}`, backdropFilter: "blur(20px)" }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.iconBg }}>
          {metricKey === "GAS" && <Fire size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "TXS_PER_BLOCK" && <ArrowsLeftRight size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "ACTIVE_ADDRESSES" && <Users size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "NET_UTILIZATION" && <Gauge size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "DEX_VOLUME" && <CurrencyDollar size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "TVL_CHANGE" && <ChartLineUp size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "STABLECOIN_FLOWS" && <Coin size={18} weight="duotone" style={{ color: c.iconColor }} />}
          {metricKey === "LIQUIDATIONS" && <Drop size={18} weight="duotone" style={{ color: c.iconColor }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>{label}</span>
            {tradeable && <TradeableBadge />}
          </div>
          {(dailyHigh !== undefined || metricKey === "NET_UTILIZATION") && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: c.bar }} />
              </div>
              <span className="text-[10px] tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
                {metricKey === "GAS"
                  ? `${(dailyLow ?? 0).toFixed(2)} / ${(dailyHigh ?? 0).toFixed(2)}`
                  : metricKey === "NET_UTILIZATION"
                  ? `0% / 100%`
                  : metricKey === "DEX_VOLUME" || metricKey === "STABLECOIN_FLOWS" || metricKey === "LIQUIDATIONS"
                  ? `${formatValue(metricKey, dailyLow ?? 0)} / ${formatValue(metricKey, dailyHigh ?? 0)}`
                  : metricKey === "TVL_CHANGE"
                  ? ""
                  : `${Math.round(dailyLow ?? 0).toLocaleString()} / ${Math.round(dailyHigh ?? 0).toLocaleString()}`}
              </span>
            </div>
          )}
        </div>
        <MiniChart values={history} color={c.bar} />
        <StateTag state={state} />
        <div className="text-right shrink-0 ml-2">
          {metricKey === "TVL_CHANGE" ? (
            (tvlValue ?? 0) === 0 && safeValue === 0 ? (
              <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight" style={{ color: "rgba(255,255,255,0.25)" }}>Loading</div>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight leading-none" style={{ color: "rgba(255,255,255,0.95)" }}>
                  {(tvlValue ?? 0) >= 1e9 ? `$${((tvlValue ?? 0) / 1e9).toFixed(2)}B` : (tvlValue ?? 0) >= 1e6 ? `$${((tvlValue ?? 0) / 1e6).toFixed(1)}M` : `$${(tvlValue ?? 0).toFixed(0)}`}
                </div>
                <div className="text-sm font-semibold tabular-nums mt-1" style={{ color: safeValue >= 0 ? "rgba(143,176,158,0.95)" : "rgba(212,160,160,0.95)" }}>
                  {`${safeValue >= 0 ? "+" : ""}${safeValue.toFixed(2)}%`}
                </div>
                <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>{unit}</div>
              </>
            )
          ) : (
            <>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight" style={{ color: safeValue === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.95)" }}>
                {formatValue(metricKey, safeValue, { tvlValue })}
              </div>
              {safeValue > 0 && (
                <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>{unit}</div>
              )}
            </>
          )}
        </div>
        <div
          className="shrink-0 transition-transform duration-300 ml-1"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.55)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {open && explanation && (
        <div className="px-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="pt-4"><ExplainCell label="What Is Happening" text={explanation.happening} icon={<Pulse size={16} weight="duotone" />} /></div>
          <div className="pt-4"><ExplainCell label="Why Is This Happening" text={explanation.why} icon={<ChartBar size={16} weight="duotone" />} /></div>
          <div className="pt-0 sm:pt-3"><ExplainCell label="What Does It Mean" text={explanation.means} icon={<Diamond size={16} weight="duotone" />} /></div>
          <div className="pt-0 sm:pt-3"><ExplainCell label="Possible Reactions" text={explanation.action} icon={<Lightning size={16} weight="duotone" />} highlight /></div>
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
  const utilState = getUtilizationState(feed.NET_UTILIZATION ?? 0);
  const dexState = getSimpleMetricState(feed.DEX_VOLUME ?? 0, feed.DEX_VOLUME_LOW ?? 0, feed.DEX_VOLUME_HIGH ?? 1);
  const tvlState = getSimpleMetricState(feed.TVL_CHANGE ?? 0, -5, 5);
  const stableState = getSimpleMetricState(feed.STABLECOIN_FLOWS ?? 0, feed.STABLECOIN_LOW ?? 0, feed.STABLECOIN_HIGH ?? 1);
  const liqState = getSimpleMetricState(feed.LIQUIDATIONS ?? 0, feed.LIQUIDATIONS_LOW ?? 0, feed.LIQUIDATIONS_HIGH ?? 1);

  const attentionScore = computeAttentionScore({
    gas: gas.current, gasHigh: feed.GAS_DAILY_HIGH ?? 0, gasLow: feed.GAS_DAILY_LOW ?? 0,
    txs: txs.current, txsHigh: feed.TXS_DAILY_HIGH ?? 0, txsLow: feed.TXS_DAILY_LOW ?? 0,
    addr: feed.ACTIVE_ADDRESSES ?? 0, addrHigh: feed.ACTIVE_DAILY_HIGH ?? 0, addrLow: feed.ACTIVE_DAILY_LOW ?? 0,
    util: (feed.NET_UTILIZATION ?? 0) / 100,
    dex: feed.DEX_VOLUME ?? 0, dexHigh: feed.DEX_VOLUME_HIGH ?? 1, dexLow: feed.DEX_VOLUME_LOW ?? 0,
    tvl: feed.TVL_CHANGE ?? 0, tvlHigh: 5, tvlLow: -5,
    stable: feed.STABLECOIN_FLOWS ?? 0, stableHigh: feed.STABLECOIN_HIGH ?? 1, stableLow: feed.STABLECOIN_LOW ?? 0,
    liq: feed.LIQUIDATIONS ?? 0, liqHigh: feed.LIQUIDATIONS_HIGH ?? 1, liqLow: feed.LIQUIDATIONS_LOW ?? 0,
  });

  return (
    <Layout>
      <div className="fixed inset-0 pointer-events-none" style={{ background: "#000000" }} />
      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-7xl px-4 sm:px-8">

        <div className="relative mb-12">
          <EthLogo />
          <div className="relative z-10 pr-32 sm:pr-56">
            <div className="text-[10px] tracking-[0.25em] uppercase font-semibold mb-4" style={{ color: "rgba(255,255,255,0.60)" }}>The Attention Market</div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Live Attention From Ethereum.
            </h1>
            <p className="text-base leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.70)" }}>
              Blockchain activity is more than numbers. Every transaction, wallet, and interaction tells a story about where attention is flowing. ChainFlux turns raw activity into signals you can understand at a glance.
            </p>
          </div>
        </div>

        <AttentionScoreCard
          score={attentionScore}
          gasState={gasState} txsState={txsState} addrState={addrState}
          gasValue={gas.current} txsValue={txs.current} addrValue={feed.ACTIVE_ADDRESSES ?? 0}
          utilState={utilState} utilValue={feed.NET_UTILIZATION ?? 0}
          dexState={dexState} dexValue={feed.DEX_VOLUME ?? 0}
          tvlState={tvlState} tvlValue={feed.TVL_VALUE ?? 0} tvlChangeValue={feed.TVL_CHANGE ?? 0}
          stableState={stableState} stableValue={feed.STABLECOIN_FLOWS ?? 0}
          liqState={liqState} liqValue={feed.LIQUIDATIONS ?? 0}
        />

        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
          <div className="text-[9px] tracking-[0.25em] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.50)" }}>Network Demand</div>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
        </div>

        <p className="text-sm leading-relaxed mb-6 max-w-xl" style={{ color: "rgba(255,255,255,0.65)" }}>
          Is Ethereum becoming busier or quieter? Track the signals that reveal whether network activity is accelerating or slowing down.
        </p>

        <div className="flex flex-col gap-4">
          <FeedRow label="Gas Price" unit="gwei" value={gas.current} metricKey="GAS" dailyHigh={feed.GAS_DAILY_HIGH} dailyLow={feed.GAS_DAILY_LOW} tradeable />
          <FeedRow label="Transactions Per Block" unit="txs" value={txs.current} metricKey="TXS_PER_BLOCK" dailyHigh={feed.TXS_DAILY_HIGH} dailyLow={feed.TXS_DAILY_LOW} tradeable />
          <FeedRow label="Active Addresses" unit="addresses" value={feed.ACTIVE_ADDRESSES} metricKey="ACTIVE_ADDRESSES" dailyHigh={feed.ACTIVE_DAILY_HIGH} dailyLow={feed.ACTIVE_DAILY_LOW} />
        </div>

        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
          <div className="text-[9px] tracking-[0.25em] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.50)" }}>Market Pressure</div>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
        </div>

        <p className="text-sm leading-relaxed mb-6 max-w-xl" style={{ color: "rgba(255,255,255,0.65)" }}>
          Capital movement, leverage, and liquidity signals that reveal where market pressure is building or releasing across Ethereum.
        </p>

        <div className="flex flex-col gap-4">
          <FeedRow label="Network Utilization" unit="capacity" value={feed.NET_UTILIZATION ?? 0} metricKey="NET_UTILIZATION" />
          <FeedRow label="DEX Volume 24h" unit="usd" value={feed.DEX_VOLUME ?? 0} metricKey="DEX_VOLUME" dailyHigh={feed.DEX_VOLUME_HIGH} dailyLow={feed.DEX_VOLUME_LOW} />
          <FeedRow label="DeFi TVL Change 24h" unit="tvl" value={feed.TVL_CHANGE ?? 0} metricKey="TVL_CHANGE" tvlValue={feed.TVL_VALUE ?? 0} />
          <FeedRow label="Stablecoin Flows" unit="usd" value={feed.STABLECOIN_FLOWS ?? 0} metricKey="STABLECOIN_FLOWS" dailyHigh={feed.STABLECOIN_HIGH} dailyLow={feed.STABLECOIN_LOW} />
          <FeedRow label="Liquidations" unit="usd" value={feed.LIQUIDATIONS ?? 0} metricKey="LIQUIDATIONS" dailyHigh={feed.LIQUIDATIONS_HIGH} dailyLow={feed.LIQUIDATIONS_LOW} />
        </div>

      </div>
    </Layout>
  );
}
