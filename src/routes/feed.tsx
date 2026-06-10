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
  ArrowsHorizontal,
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
  BRIDGE_FLOWS: {
    low: {
      happening: "Minimal capital is moving across chains.",
      why: "Users are not actively bridging assets into or out of Ethereum.",
      means: "Capital is staying within existing ecosystems with no strong rotation pressure.",
      action: "Cross-chain demand is weak. No directional signal from external capital flows.",
    },
    medium: {
      happening: "Bridge activity is at a normal level.",
      why: "Routine capital movement between chains continues steadily without acceleration.",
      means: "Balanced cross-chain liquidity with no strong migration trend in either direction.",
      action: "No directional signal in capital flow. Monitor for a shift toward elevated inflows.",
    },
    high: {
      happening: "Large volumes of assets are moving across bridges.",
      why: "Capital is rotating between ecosystems due to yield opportunities, sentiment shifts, or major events.",
      means: "Strong cross-chain repositioning of liquidity. Ethereum is either gaining or losing capital at scale.",
      action: "Important macro signal. Often aligns with broader market rotations and trend formation.",
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
  bridgeState: "low" | "medium" | "high",
  stableState: "low" | "medium" | "high",
  liqState: "low" | "medium" | "high",
  tvlState: "low" | "medium" | "high"
): MarketPhase {
  const stateScore = (s: "low" | "medium" | "high") => s === "high" ? 2 : s === "medium" ? 1 : 0;
  const demandScore = stateScore(gasState) + stateScore(txsState) + stateScore(addrState);
  const liquidityScore = stateScore(dexState) + stateScore(bridgeState) + stateScore(stableState) + stateScore(tvlState);
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
  util: number; utilHigh: number; utilLow: number;
  dex: number; dexHigh: number; dexLow: number;
  tvl: number; tvlHigh: number; tvlLow: number;
  bridge: number; bridgeHigh: number; bridgeLow: number;
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
    norm(s.util, s.utilLow, s.utilHigh) * 0.15 +
    norm(s.dex, s.dexLow, s.dexHigh) * 0.10 +
    norm(s.tvl, s.tvlLow, s.tvlHigh) * 0.10 +
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

function formatValue(metric: string, value: number): string {
  if (value === 0) return "Loading";
  if (metric === "GAS") return value.toFixed(4);
  if (metric === "NET_UTILIZATION") return `${value.toFixed(1)}%`;
  if (
    metric === "DEX_VOLUME" || metric === "TVL_CHANGE" || metric === "BRIDGE_FLOWS" ||
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
        border: "1px solid rgba(52,211,153,0.35)",
        color: "rgba(110,231,183,0.90)",
      }}
    >
      Tradeable
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
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
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
    >
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.70)" }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="text-[9px] tracking-[0.22em] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>{label}</div>
        <div className="text-sm leading-relaxed" style={{ color: highlight ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)" }}>
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
  const gasDesc = {
    low: "Gas fees are low, indicating minimal competition for block space.",
    medium: "Gas fees are at a moderate level, reflecting steady but unremarkable demand for block space.",
    high: "Gas fees are elevated, signaling strong competition for block space and high execution demand.",
  };
  const txsDesc = {
    low: "Block throughput is quiet, with relatively few transactions being processed.",
    medium: "Blocks are processing a steady volume of transactions without any notable congestion.",
    high: "Blocks are filling with a high number of transactions, reflecting intense network usage.",
  };
  const addrDesc = {
    low: "Wallet participation is light, with fewer unique addresses active on the network.",
    medium: "Wallet participation is moderate, with a typical number of addresses transacting.",
    high: "Wallet participation is broad, with a large number of unique addresses active across the network.",
  };
  const allHigh = gasState === "high" && txsState === "high" && addrState === "high";
  const allLow = gasState === "low" && txsState === "low" && addrState === "low";
  const mostlyHigh = [gasState, txsState, addrState].filter(s => s === "high").length >= 2;
  const mostlyLow = [gasState, txsState, addrState].filter(s => s === "low").length >= 2;
  let closing = "";
  if (allHigh) closing = "All three signals are elevated simultaneously, which is a strong indicator of coordinated network demand and broad user activity.";
  else if (allLow) closing = "The network is quiet across all dimensions with no signs of unusual demand, congestion, or elevated participation.";
  else if (mostlyHigh) closing = "The majority of network signals are elevated, suggesting broad demand is building even if not every metric is at its peak.";
  else if (mostlyLow) closing = "Most signals are subdued, pointing to a generally quiet network with limited pressure across gas, throughput, and participation.";
  else closing = "Signals are mixed across the network, reflecting uneven activity rather than a uniform shift in one direction.";
  return `${gasDesc[gasState]} ${txsDesc[txsState]} ${addrDesc[addrState]} ${closing}`;
}

function AnimatedDonut({
  segments,
  animate,
  size = 220,
}: {
  segments: { label: string; weight: number; state: "low" | "medium" | "high" }[];
  animate: boolean;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const strokeWidth = size * 0.10;
  const circumference = 2 * Math.PI * r;
  const gapDeg = 3;
  const gapFraction = (gapDeg / 360) * circumference;
  const totalGap = gapFraction * segments.length;
  const usable = circumference - totalGap;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const segLen = seg.weight * usable;
    const dashArray = `${segLen} ${circumference - segLen}`;
    const dashOffset = -(offset);
    offset += segLen + gapFraction;
    const color = STATE_SEGMENT_COLORS[seg.state];
    const glow = STATE_GLOW[seg.state];
    return { seg, color, glow, dashArray, dashOffset, segLen };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)" }}
    >
      <defs>
        {arcs.map(({ seg, glow }) => (
          <filter key={`glow-${seg.label}`} id={`glow-${seg.label}-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor={glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {arcs.map(({ seg, color, dashArray, dashOffset, segLen }) => (
        <circle
          key={seg.label}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={dashArray}
          strokeDashoffset={
            animate
              ? dashOffset
              : dashOffset - segLen
          }
          filter={`url(#glow-${seg.label}-${size})`}
          style={{
            transition: animate
              ? `stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1) ${arcs.findIndex(a => a.seg.label === seg.label) * 0.08}s`
              : "none",
          }}
        />
      ))}
    </svg>
  );
}

function ScoreBreakdown({
  gasState, txsState, addrState, gasValue, txsValue, addrValue,
  utilState, utilValue, dexState, dexValue, tvlState, tvlValue,
  bridgeState, bridgeValue, stableState, stableValue, liqState, liqValue,
  score,
}: {
  gasState: "low" | "medium" | "high"; txsState: "low" | "medium" | "high"; addrState: "low" | "medium" | "high";
  gasValue: number; txsValue: number; addrValue: number;
  utilState: "low" | "medium" | "high"; utilValue: number;
  dexState: "low" | "medium" | "high"; dexValue: number;
  tvlState: "low" | "medium" | "high"; tvlValue: number;
  bridgeState: "low" | "medium" | "high"; bridgeValue: number;
  stableState: "low" | "medium" | "high"; stableValue: number;
  liqState: "low" | "medium" | "high"; liqValue: number;
  score: number;
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(t);
  }, []);

  const summary = buildNetworkSummary(gasState, txsState, addrState);
  const stateLabel: Record<"low" | "medium" | "high", string> = { low: "Cooling", medium: "Stable", high: "Surging" };
  const level = getAttentionLevel(score);
  const info = ATTENTION_LABELS[level];

  const segments = [
    { label: "Gas", weight: 0.20, state: gasState },
    { label: "TXS", weight: 0.20, state: txsState },
    { label: "Addr", weight: 0.10, state: addrState },
    { label: "Util", weight: 0.15, state: utilState },
    { label: "DEX", weight: 0.10, state: dexState },
    { label: "TVL", weight: 0.10, state: tvlState },
    { label: "Stable", weight: 0.05, state: stableState },
    { label: "Liq", weight: 0.10, state: liqState },
  ];

  const rows = [
    { label: "Gas Price", key: "GAS", weight: "20%", state: gasState, value: gasValue > 0 ? `${gasValue.toFixed(2)} gwei` : "Loading", icon: <Fire size={18} weight="duotone" /> },
    { label: "Transactions Per Block", key: "TXS_PER_BLOCK", weight: "20%", state: txsState, value: txsValue > 0 ? `${Math.round(txsValue).toLocaleString()} txs` : "Loading", icon: <ArrowsLeftRight size={18} weight="duotone" /> },
    { label: "Active Addresses", key: "ACTIVE_ADDRESSES", weight: "10%", state: addrState, value: addrValue > 0 ? Math.round(addrValue).toLocaleString() : "Loading", icon: <Users size={18} weight="duotone" /> },
    { label: "Network Utilization", key: "NET_UTILIZATION", weight: "15%", state: utilState, value: utilValue > 0 ? `${utilValue.toFixed(1)}%` : "Loading", icon: <Gauge size={18} weight="duotone" /> },
    { label: "DEX Volume 24h", key: "DEX_VOLUME", weight: "10%", state: dexState, value: dexValue > 0 ? formatValue("DEX_VOLUME", dexValue) : "Loading", icon: <CurrencyDollar size={18} weight="duotone" /> },
    { label: "DeFi TVL Change 24h", key: "TVL_CHANGE", weight: "10%", state: tvlState, value: tvlValue > 0 ? formatValue("TVL_CHANGE", tvlValue) : "Loading", icon: <ChartLineUp size={18} weight="duotone" /> },
    { label: "Stablecoin Flows", key: "STABLECOIN_FLOWS", weight: "5%", state: stableState, value: stableValue > 0 ? formatValue("STABLECOIN_FLOWS", stableValue) : "Loading", icon: <Coin size={18} weight="duotone" /> },
    { label: "Liquidations", key: "LIQUIDATIONS", weight: "10%", state: liqState, value: liqValue > 0 ? formatValue("LIQUIDATIONS", liqValue) : "Loading", icon: <Drop size={18} weight="duotone" /> },
  ];

  return (
    <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
      <div className="flex flex-col items-center mb-8">
        <div className="relative" style={{ width: 240, height: 240 }}>
          <AnimatedDonut segments={segments} animate={animate} size={240} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ transform: "rotate(0deg)" }}>
            <div className="text-5xl font-bold tabular-nums leading-none" style={{ color: info.color }}>{score}</div>
            <div className="text-[9px] tracking-[0.25em] uppercase mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>Attention Score</div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_SEGMENT_COLORS[seg.state] }} />
              <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>{seg.label}</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{(seg.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const color = STATE_SEGMENT_COLORS[row.state];
          const glow = STATE_GLOW[row.state];
          const c = STATE_COLORS[row.state];
          return (
            <div
              key={row.key}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${c.border}`, boxShadow: `0 0 12px ${glow}` }}
            >
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.iconBg, color: c.iconColor }}>
                {row.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-xs leading-tight truncate">{row.label}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] tracking-[0.15em] uppercase font-bold px-1.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                    {stateLabel[row.state]}
                  </span>
                  <span className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>{row.weight}</span>
                </div>
              </div>
              <div className="shrink-0 text-right font-bold tabular-nums text-sm" style={{ color }}>{row.value}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
        <div className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>Network Summary</div>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.90)" }}>{summary}</p>
      </div>
    </div>
  );
}

function AttentionScoreCard({
  score, gasState, txsState, addrState, gasValue, txsValue, addrValue,
  utilState, utilValue, dexState, dexValue, tvlState, tvlValue,
  bridgeState, bridgeValue, stableState, stableValue, liqState, liqValue,
}: {
  score: number;
  gasState: "low" | "medium" | "high"; txsState: "low" | "medium" | "high"; addrState: "low" | "medium" | "high";
  gasValue: number; txsValue: number; addrValue: number;
  utilState: "low" | "medium" | "high"; utilValue: number;
  dexState: "low" | "medium" | "high"; dexValue: number;
  tvlState: "low" | "medium" | "high"; tvlValue: number;
  stableState: "low" | "medium" | "high"; stableValue: number;
  liqState: "low" | "medium" | "high"; liqValue: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const level = getAttentionLevel(score);
  const info = ATTENTION_LABELS[level];
  const phase = computeMarketPhase(score, gasState, txsState, addrState, dexState, bridgeState, stableState, liqState, tvlState);
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
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={info.color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 6px ${info.color})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold text-white tabular-nums leading-none">{score}</div>
            <div className="text-[9px] tracking-[0.2em] uppercase mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>Score</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.25em] uppercase font-semibold mb-3" style={{ color: "rgba(255,255,255,0.60)" }}>Ethereum Attention State</div>
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
              <div className="absolute rounded-full" style={{ width: 18, height: 18, background: info.ring }} />
              <div className="relative rounded-full" style={{ width: 9, height: 9, background: info.color }} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white leading-tight">{info.label}</div>
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>{info.interpretation}</p>
          <div
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
            style={{ background: phase.ring, border: `1px solid ${phase.color}40` }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: phase.color }} />
            <span className="text-xs font-bold tracking-wide" style={{ color: phase.color }}>{phase.label}</span>
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.80)" }}>{phase.summary}</p>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{phase.interpretation}</p>
        </div>
        <div
          className="shrink-0 transition-transform duration-300 self-start sm:self-center ml-auto sm:ml-0"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.55)" }}
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M2 5L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {expanded && (
        <ScoreBreakdown
          score={score}
          gasState={gasState} txsState={txsState} addrState={addrState}
          gasValue={gasValue} txsValue={txsValue} addrValue={addrValue}
          utilState={utilState} utilValue={utilValue}
          dexState={dexState} dexValue={dexValue}
          tvlState={tvlState} tvlValue={tvlValue}
          stableState={stableState} stableValue={stableValue}
          liqState={liqState} liqValue={liqValue}
        />
      )}
    </div>
  );
}

function FeedRow({
  label, unit, value, metricKey, dailyHigh, dailyLow, tradeable,
}: {
  label: string; unit: string; value: number; metricKey: string;
  dailyHigh?: number; dailyLow?: number; tradeable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const state = metricKey === "GAS" || metricKey === "TXS_PER_BLOCK" || metricKey === "ACTIVE_ADDRESSES"
    ? getMetricState(metricKey, value)
    : getSimpleMetricState(value, dailyLow ?? 0, dailyHigh ?? 0);
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
    NET_UTILIZATION: <Gauge size={20} weight="duotone" />,
    DEX_VOLUME: <CurrencyDollar size={20} weight="duotone" />,
    TVL_CHANGE: <ChartLineUp size={20} weight="duotone" />,
    STABLECOIN_FLOWS: <Coin size={20} weight="duotone" />,
    LIQUIDATIONS: <Drop size={20} weight="duotone" />,
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
      <div className="flex items-center gap-4 px-5 py-6 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: c.iconBg, color: c.iconColor }}>
          {metricIcon[metricKey]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-white font-bold text-base tracking-tight truncate">{label}</div>
            {tradeable && <TradeableBadge />}
          </div>
          {(dailyHigh ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.10)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clampedPosition}%`, background: `linear-gradient(90deg, #818cf8, ${c.bar})` }} />
              </div>
              <span className="text-[9px] tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.50)" }}>
                {metricKey === "GAS"
                  ? `${(dailyLow ?? 0).toFixed(2)} / ${(dailyHigh ?? 0).toFixed(2)}`
                  : metricKey === "NET_UTILIZATION"
                  ? `${(dailyLow ?? 0).toFixed(1)}% / ${(dailyHigh ?? 0).toFixed(1)}%`
                  : metricKey === "DEX_VOLUME" || metricKey === "TVL_CHANGE" || metricKey === "BRIDGE_FLOWS" || metricKey === "STABLECOIN_FLOWS" || metricKey === "LIQUIDATIONS"
                  ? `${formatValue(metricKey, dailyLow ?? 0)} / ${formatValue(metricKey, dailyHigh ?? 0)}`
                  : `${Math.round(dailyLow ?? 0).toLocaleString()} / ${Math.round(dailyHigh ?? 0).toLocaleString()}`}
              </span>
            </div>
          )}
        </div>
        <MiniChart values={history} color={c.bar} />
        <StateTag state={state} />
        <div className="text-right shrink-0 ml-2">
          <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight" style={{ color: value === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.95)" }}>
            {formatValue(metricKey, value)}
          </div>
          {value > 0 && (
            <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>{unit}</div>
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

interface PressureData {
  utilization: number; utilizationHigh: number; utilizationLow: number;
  dexVolume: number; dexHigh: number; dexLow: number;
  bridgeVolume: number; bridgeHigh: number; bridgeLow: number;
  stableVolume: number; stableHigh: number; stableLow: number;
  liqVolume: number; liqHigh: number; liqLow: number;
}

async function fetchPressureData(etherscanKey: string): Promise<PressureData> {
  const results = await Promise.allSettled([
    fetch(`https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getBlockByNumber&tag=latest&boolean=true&apikey=${etherscanKey}`)
      .then(r => r.json()),
    fetch("https://api.llama.fi/overview/dexs/ethereum?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume")
      .then(r => r.json()),
    fetch("https://api.llama.fi/v2/historicalChainTvl/ethereum")
      .then(r => r.json()),
    fetch("https://stablecoins.llama.fi/stablecoinchains")
      .then(r => r.json()),
    fetch("https://api.llama.fi/overview/options/ethereum?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyNotionalVolume")
      .then(r => r.json()),
  ]);

  let utilization = 50;
  if (results[0].status === "fulfilled") {
    try {
      const block = results[0].value?.result;
      if (block?.gasUsed && block?.gasLimit) {
        const used = parseInt(block.gasUsed, 16);
        const limit = parseInt(block.gasLimit, 16);
        utilization = limit > 0 ? (used / limit) * 100 : 50;
      }
    } catch { utilization = 50; }
  }

  let dexVolume = 0;
  if (results[1].status === "fulfilled") {
    try { dexVolume = results[1].value?.total24h ?? 0; } catch { dexVolume = 0; }
  }

  let bridgeVolume = 0;
  if (results[2].status === "fulfilled") {
    try {
      const data = results[2].value;
      if (Array.isArray(data) && data.length >= 2) {
        const recent = data.slice(-2);
        bridgeVolume = Math.abs((recent[1].tvl ?? 0) - (recent[0].tvl ?? 0));
      }
    } catch { bridgeVolume = 0; }
  }

  let stableVolume = 0;
  if (results[3].status === "fulfilled") {
    try {
      const chains = results[3].value;
      if (Array.isArray(chains)) {
        const eth = chains.find((c: any) => c.name?.toLowerCase() === "ethereum");
        const rawChange = eth?.change_1d ?? 0;
        stableVolume = Math.abs(rawChange);
        if (stableVolume === 0 && eth?.totalCirculatingUSD?.peggedUSD) {
          stableVolume = eth.totalCirculatingUSD.peggedUSD * 0.001;
        }
        if (stableVolume === 0 && eth?.totalCirculatingUSD) {
          const total = typeof eth.totalCirculatingUSD === "number"
            ? eth.totalCirculatingUSD
            : Object.values(eth.totalCirculatingUSD as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
          stableVolume = total * 0.001;
        }
      }
    } catch { stableVolume = 0; }
  }

  let liqVolume = 0;
  if (results[4].status === "fulfilled") {
    try {
      const data = results[4].value;
      liqVolume = data?.total24h ?? data?.totalNotionalVolume24h ?? 0;
    } catch { liqVolume = 0; }
  }

  const estimate = (v: number, floor = 0) => ({ hi: Math.max(v * 1.8 + 1, floor + 1), lo: Math.max(v * 0.3, floor) });
  const util = { hi: 100, lo: 0 };
  const dex = estimate(dexVolume);
  const bridge = estimate(bridgeVolume);
  const stable = estimate(stableVolume);
  const liq = estimate(liqVolume);

  return {
    utilization, utilizationHigh: util.hi, utilizationLow: util.lo,
    dexVolume, dexHigh: dex.hi, dexLow: dex.lo,
    bridgeVolume, bridgeHigh: bridge.hi, bridgeLow: bridge.lo,
    stableVolume, stableHigh: stable.hi, stableLow: stable.lo,
    liqVolume, liqHigh: liq.hi, liqLow: liq.lo,
  };
}

const ETHERSCAN_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY ?? "";

function usePressureData() {
  const [data, setData] = useState<PressureData>({
    utilization: 0, utilizationHigh: 100, utilizationLow: 0,
    dexVolume: 0, dexHigh: 1, dexLow: 0,
    bridgeVolume: 0, bridgeHigh: 1, bridgeLow: 0,
    stableVolume: 0, stableHigh: 1, stableLow: 0,
    liqVolume: 0, liqHigh: 1, liqLow: 0,
  });

  useEffect(() => {
    const load = () => fetchPressureData(ETHERSCAN_KEY).then(setData).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  return data;
}

function FeedPage() {
  const feed = useNetworkFeed();
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");
  const pressure = usePressureData();

  const gasState = getMetricState("GAS", gas.current);
  const txsState = getMetricState("TXS_PER_BLOCK", txs.current);
  const addrState = getMetricState("ACTIVE_ADDRESSES", feed.ACTIVE_ADDRESSES ?? 0);
  const utilState = getSimpleMetricState(pressure.utilization, pressure.utilizationLow, pressure.utilizationHigh);
  const dexState = getSimpleMetricState(pressure.dexVolume, pressure.dexLow, pressure.dexHigh);
  const tvlState = getSimpleMetricState(feed.TVL_CHANGE ?? 0, 0, Math.max(feed.TVL_CHANGE * 2, 1));
  const bridgeState = getSimpleMetricState(pressure.bridgeVolume, pressure.bridgeLow, pressure.bridgeHigh);
  const stableState = getSimpleMetricState(pressure.stableVolume, pressure.stableLow, pressure.stableHigh);
  const liqState = getSimpleMetricState(pressure.liqVolume, pressure.liqLow, pressure.liqHigh);

  const attentionScore = computeAttentionScore({
    gas: gas.current, gasHigh: feed.GAS_DAILY_HIGH ?? 0, gasLow: feed.GAS_DAILY_LOW ?? 0,
    txs: txs.current, txsHigh: feed.TXS_DAILY_HIGH ?? 0, txsLow: feed.TXS_DAILY_LOW ?? 0,
    addr: feed.ACTIVE_ADDRESSES ?? 0, addrHigh: feed.ACTIVE_DAILY_HIGH ?? 0, addrLow: feed.ACTIVE_DAILY_LOW ?? 0,
    util: pressure.utilization, utilHigh: pressure.utilizationHigh, utilLow: pressure.utilizationLow,
    dex: pressure.dexVolume, dexHigh: pressure.dexHigh, dexLow: pressure.dexLow,
    tvl: feed.TVL_CHANGE ?? 0, tvlHigh: Math.max((feed.TVL_CHANGE ?? 0) * 2, 1), tvlLow: 0,
    bridge: pressure.bridgeVolume, bridgeHigh: pressure.bridgeHigh, bridgeLow: pressure.bridgeLow,
    stable: pressure.stableVolume, stableHigh: pressure.stableHigh, stableLow: pressure.stableLow,
    liq: pressure.liqVolume, liqHigh: pressure.liqHigh, liqLow: pressure.liqLow,
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
          utilState={utilState} utilValue={pressure.utilization}
          dexState={dexState} dexValue={pressure.dexVolume}
          tvlState={tvlState} tvlValue={feed.TVL_CHANGE ?? 0}
          bridgeState={bridgeState} bridgeValue={pressure.bridgeVolume}
          stableState={stableState} stableValue={pressure.stableVolume}
          liqState={liqState} liqValue={pressure.liqVolume}
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
          <FeedRow label="Network Utilization" unit="capacity" value={pressure.utilization} metricKey="NET_UTILIZATION" dailyHigh={pressure.utilizationHigh} dailyLow={pressure.utilizationLow} />
          <FeedRow label="DEX Volume 24h" unit="usd" value={pressure.dexVolume} metricKey="DEX_VOLUME" dailyHigh={pressure.dexHigh} dailyLow={pressure.dexLow} />
          <FeedRow label="DeFi TVL Change 24h" unit="usd" value={feed.TVL_CHANGE ?? 0} metricKey="TVL_CHANGE" dailyHigh={Math.max((feed.TVL_CHANGE ?? 0) * 2, 1)} dailyLow={0} />
          <FeedRow label="Stablecoin Flows" unit="usd" value={pressure.stableVolume} metricKey="STABLECOIN_FLOWS" dailyHigh={pressure.stableHigh} dailyLow={pressure.stableLow} />
          <FeedRow label="Liquidations" unit="usd" value={pressure.liqVolume} metricKey="LIQUIDATIONS" dailyHigh={pressure.liqHigh} dailyLow={pressure.liqLow} />
        </div>

      </div>
    </Layout>
  );
}
