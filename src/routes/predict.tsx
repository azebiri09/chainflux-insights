import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { useWallet, connectWallet } from "@/lib/wallet";

export const Route = createFileRoute("/predict")({
  component: PredictPage,
  head: () => ({ meta: [{ title: "Predict — ChainFlux" }] }),
});

const KEEPER_URL = "https://chainflux-production.up.railway.app";
const PROXY = "0x7708a4C85F526E23090d3B27201487E91AF58694";

const PREDICT_ABI = [
  "function stake(uint256 roundId, uint8 direction) payable",
  "function claim(uint256 roundId)",
  "function rounds(uint256 roundId) view returns (uint256 id, uint8 metric, uint8 timeframe, uint256 startValue, uint256 endValue, uint256 openTime, uint256 closeTime, uint256 higherPool, uint256 lowerPool, uint8 status, uint8 result)",
  "function getUserStake(uint256 roundId, address user) view returns (uint256 amount, uint8 direction, bool claimed)",
  "function getLatestRound(uint8 metric, uint8 timeframe) view returns (uint256)",
];

// ─── ACTIVE METRICS ONLY ──────────────────────────────────────────────────────

type ActiveMetric = "ACTIVE_ADDRESSES" | "GAS_PRICE" | "TXS_PER_BLOCK";

const ACTIVE_METRICS: ActiveMetric[] = [
  "ACTIVE_ADDRESSES",
  "GAS_PRICE",
  "TXS_PER_BLOCK",
];

// Contract IDs — fixed, never change
// ACTIVE_ADDRESSES = 0, GAS_PRICE repurposed as ID 2, TXS_PER_BLOCK repurposed as ID 3
const METRIC_CONTRACT_ID: Record<ActiveMetric, number> = {
  ACTIVE_ADDRESSES: 0,
  GAS_PRICE: 2,
  TXS_PER_BLOCK: 3,
};

const METRIC_LABEL: Record<ActiveMetric, string> = {
  ACTIVE_ADDRESSES: "Active Addresses",
  GAS_PRICE: "Gas Price",
  TXS_PER_BLOCK: "Transactions Per Block",
};

const METRIC_UNIT: Record<ActiveMetric, string> = {
  ACTIVE_ADDRESSES: "addresses",
  GAS_PRICE: "gwei",
  TXS_PER_BLOCK: "txs",
};

// ─── FEED ─────────────────────────────────────────────────────────────────────

type FeedData = {
  ACTIVE_ADDRESSES: number;
  ACTIVE_DAILY_HIGH: number;
  ACTIVE_DAILY_LOW: number;
  GAS: number;
  GAS_DAILY_HIGH: number;
  GAS_DAILY_LOW: number;
  TXS_PER_BLOCK: number;
  TXS_DAILY_HIGH: number;
  TXS_DAILY_LOW: number;
  updatedAt: number;
};

const EMPTY_FEED: FeedData = {
  ACTIVE_ADDRESSES: 0,
  ACTIVE_DAILY_HIGH: 0,
  ACTIVE_DAILY_LOW: 0,
  GAS: 0,
  GAS_DAILY_HIGH: 0,
  GAS_DAILY_LOW: 0,
  TXS_PER_BLOCK: 0,
  TXS_DAILY_HIGH: 0,
  TXS_DAILY_LOW: 0,
  updatedAt: 0,
};

function useFeed() {
  const [feed, setFeed] = useState<FeedData>(EMPTY_FEED);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch(`${KEEPER_URL}/feed`);
        const data = await res.json();
        setFeed(data);
      } catch (e) {
        console.error("Feed fetch error:", e);
      }
    }
    fetchFeed();
    const id = setInterval(fetchFeed, 30_000);
    return () => clearInterval(id);
  }, []);

  return feed;
}

function getMetricValues(metric: ActiveMetric, feed: FeedData) {
  switch (metric) {
    case "ACTIVE_ADDRESSES":
      return {
        current: feed.ACTIVE_ADDRESSES,
        high: feed.ACTIVE_DAILY_HIGH,
        low: feed.ACTIVE_DAILY_LOW,
      };
    case "GAS_PRICE":
      return {
        current: feed.GAS,
        high: feed.GAS_DAILY_HIGH,
        low: feed.GAS_DAILY_LOW,
      };
    case "TXS_PER_BLOCK":
      return {
        current: feed.TXS_PER_BLOCK,
        high: feed.TXS_DAILY_HIGH,
        low: feed.TXS_DAILY_LOW,
      };
  }
}

// ─── DYNAMIC QUESTIONS ────────────────────────────────────────────────────────

function getDynamicQuestion(
  metric: ActiveMetric,
  current: number,
  high: number,
  low: number
): string {
  if (high === 0) {
    switch (metric) {
      case "ACTIVE_ADDRESSES": return "Will active addresses increase?";
      case "GAS_PRICE": return "Will gas be higher in 1 hour?";
      case "TXS_PER_BLOCK": return "Will transactions per block increase?";
    }
  }

  const range = high - low;
  const position = range > 0 ? (current - low) / range : 0.5;

  switch (metric) {
    case "ACTIVE_ADDRESSES":
      if (position > 0.8) return "Will addresses reach today's high?";
      if (position < 0.2) return "Will active addresses rise by more than 10%?";
      return "Will active addresses increase?";

    case "GAS_PRICE":
      if (position > 0.8) return `Will gas exceed ${high.toFixed(2)} gwei?`;
      if (position < 0.2) return "Will gas rise by more than 10%?";
      return "Will gas be higher in 1 hour?";

    case "TXS_PER_BLOCK":
      if (position > 0.8) return "Will transactions reach today's high?";
      if (position < 0.2) return "Will transactions rise by more than 5%?";
      return "Will transactions per block increase?";
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatValue(metric: ActiveMetric, value: number): string {
  if (value === 0) return "Loading";
  switch (metric) {
    case "GAS_PRICE": return value.toFixed(4);
    case "TXS_PER_BLOCK": return Math.round(value).toLocaleString();
    case "ACTIVE_ADDRESSES": return Math.round(value).toLocaleString();
  }
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "0";
  if (eth < 0.0001) return "<0.0001";
  return eth.toFixed(4);
}

function formatCountdown(endTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(endTime) - now;
  if (diff <= 0) return "Closing";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function poolSplit(higher: bigint, lower: bigint) {
  const total = higher + lower;
  if (total === 0n) return { higherPct: 50, lowerPct: 50 };
  const h = Math.round((Number(higher) / Number(total)) * 100);
  return { higherPct: h, lowerPct: 100 - h };
}

function getActivityColor(position: number) {
  if (position > 0.65)
    return {
      dot: "#34d399",
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(16,185,129,0.22)",
      text: "rgba(110,231,183,0.9)",
      label: "High",
    };
  if (position > 0.35)
    return {
      dot: "#facc15",
      bg: "rgba(234,179,8,0.10)",
      border: "rgba(234,179,8,0.22)",
      text: "rgba(253,224,71,0.9)",
      label: "Mid",
    };
  return {
    dot: "#818cf8",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.25)",
    text: "rgba(165,180,252,0.9)",
    label: "Low",
  };
}

// ─── CONTRACT HELPERS ─────────────────────────────────────────────────────────

async function getReadContract() {
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
  return new ethers.Contract(PROXY, PREDICT_ABI, provider);
}

async function getWriteContract() {
  const { ethers } = await import("ethers");
  if (!window.ethereum) throw new Error("No wallet");
  const provider = new ethers.BrowserProvider(window.ethereum as any);
  const signer = await provider.getSigner();
  return new ethers.Contract(PROXY, PREDICT_ABI, signer);
}

// ─── COUNTDOWN HOOK ───────────────────────────────────────────────────────────

function useCountdown(endTime: bigint | undefined): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endTime) return "Loading";
  return formatCountdown(endTime);
}

// ─── ROUND DATA ───────────────────────────────────────────────────────────────

const STATUS = { OPEN: 0, RESOLVED: 1, CANCELLED: 2 };

type RoundData = {
  roundId: bigint;
  startValue: bigint;
  endValue: bigint;
  higherPool: bigint;
  lowerPool: bigint;
  status: number;
  startTime: bigint;
  endTime: bigint;
};

type UserStake = {
  amount: bigint;
  direction: number;
  claimed: boolean;
};

type CardState = {
  round: RoundData | null;
  userStake: UserStake | null;
  loading: boolean;
  staking: boolean;
  claiming: boolean;
  txError: string | null;
  txSuccess: string | null;
  amount: string;
};

// ─── METRIC CARD ──────────────────────────────────────────────────────────────

function MetricCard({
  metric,
  timeframe,
  feed,
}: {
  metric: ActiveMetric;
  timeframe: 0 | 1;
  feed: FeedData;
}) {
  const wallet = useWallet();
  const contractId = METRIC_CONTRACT_ID[metric];
  const { current, high, low } = getMetricValues(metric, feed);
  const range = high - low;
  const position = range > 0 ? (current - low) / range : 0.5;
  const color = getActivityColor(position);
  const question = getDynamicQuestion(metric, current, high, low);

  const [card, setCard] = useState<CardState>({
    round: null,
    userStake: null,
    loading: true,
    staking: false,
    claiming: false,
    txError: null,
    txSuccess: null,
    amount: "",
  });

  const countdown = useCountdown(card.round?.endTime);

  const load = useCallback(async () => {
    try {
      const contract = await getReadContract();
      const roundId: bigint = await contract.getLatestRound(contractId, timeframe);
      const raw = await contract.rounds(roundId);
      const round: RoundData = {
        roundId,
        startValue: raw[3],
        endValue: raw[4],
        higherPool: raw[7],
        lowerPool: raw[8],
        status: Number(raw[9]),
        startTime: raw[5],
        endTime: raw[6],
      };
      let userStake: UserStake | null = null;
      if (wallet) {
        const us = await contract.getUserStake(roundId, wallet);
        userStake = { amount: us[0], direction: Number(us[1]), claimed: us[2] };
      }
      setCard((c) => ({ ...c, round, userStake, loading: false }));
    } catch (e: any) {
      console.error(`Load error ${metric}:`, e?.message);
      setCard((c) => ({ ...c, loading: false }));
    }
  }, [contractId, timeframe, wallet]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleStake(direction: 0 | 1) {
    if (!wallet) { connectWallet(); return; }
    if (!card.round) return;
    const amtStr = card.amount.trim();
    if (!amtStr || isNaN(Number(amtStr)) || Number(amtStr) <= 0) {
      setCard((c) => ({ ...c, txError: "Enter a valid ETH amount" }));
      return;
    }
    setCard((c) => ({ ...c, staking: true, txError: null, txSuccess: null }));
    try {
      const { ethers } = await import("ethers");
      const contract = await getWriteContract();
      const value = ethers.parseEther(amtStr);
      const tx = await contract.stake(card.round!.roundId, direction, { value });
      await tx.wait();
      setCard((c) => ({
        ...c,
        staking: false,
        txSuccess: `Staked ${amtStr} ETH on ${direction === 0 ? "Higher" : "Lower"}`,
        amount: "",
      }));
      load();
    } catch (e: any) {
      setCard((c) => ({
        ...c,
        staking: false,
        txError: e?.reason || e?.message || "Transaction failed",
      }));
    }
  }

  async function handleClaim() {
    if (!wallet || !card.round) return;
    setCard((c) => ({ ...c, claiming: true, txError: null, txSuccess: null }));
    try {
      const contract = await getWriteContract();
      const tx = await contract.claim(card.round!.roundId);
      await tx.wait();
      setCard((c) => ({ ...c, claiming: false, txSuccess: "Winnings claimed" }));
      load();
    } catch (e: any) {
      setCard((c) => ({
        ...c,
        claiming: false,
        txError: e?.reason || e?.message || "Claim failed",
      }));
    }
  }

  const { higherPct, lowerPct } = card.round
    ? poolSplit(card.round.higherPool, card.round.lowerPool)
    : { higherPct: 50, lowerPct: 50 };

  const isOpen = card.round?.status === STATUS.OPEN;
  const isResolved = card.round?.status === STATUS.RESOLVED;
  const canClaim =
    isResolved &&
    card.userStake &&
    card.userStake.amount > 0n &&
    !card.userStake.claimed;
  const totalPool = card.round ? card.round.higherPool + card.round.lowerPool : 0n;

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color.dot }} />
          <div className="font-semibold text-white text-sm tracking-wide leading-tight truncate">
            {METRIC_LABEL[metric]}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full font-semibold shrink-0"
          style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color.dot }} />
          {color.label}
        </span>
      </div>

      {/* Live value */}
      <div className="px-5 pb-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-white/90 tabular-nums">
          {formatValue(metric, current)}
        </span>
        <span className="text-xs text-white/30 uppercase tracking-widest">
          {METRIC_UNIT[metric]}
        </span>
      </div>

      {/* Daily range bar */}
      {high > 0 && (
        <div className="px-5 pt-2 pb-3">
          <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/25 mb-1.5">
            <span>Low {metric === "GAS_PRICE" ? low.toFixed(2) : Math.round(low).toLocaleString()}</span>
            <span>High {metric === "GAS_PRICE" ? high.toFixed(2) : Math.round(high).toLocaleString()}</span>
          </div>
          <div className="relative h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(2, position * 100))}%`,
                background: `linear-gradient(90deg, #818cf8, ${color.dot})`,
              }}
            />
          </div>
        </div>
      )}

      {/* Dynamic question */}
      <div className="px-5 pb-3">
        <p className="text-white/70 text-sm leading-snug font-medium">
          {question}
        </p>
      </div>

      {/* Pool split */}
      <div className="px-5 pb-3">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/30 mb-1.5">
          <span>Higher {higherPct}%</span>
          <span>Lower {lowerPct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${higherPct}%`,
              background: "linear-gradient(90deg, #34d399, #818cf8)",
            }}
          />
        </div>
      </div>

      {/* Status row */}
      <div className="px-5 pb-4 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-white/30">
          {card.loading
            ? "Loading"
            : isOpen
            ? `Closes ${countdown}`
            : isResolved
            ? "Resolved"
            : "Inactive"}
        </div>
        {!card.loading && totalPool > 0n && (
          <div className="text-[10px] uppercase tracking-widest text-white/30">
            Pool {formatEth(totalPool)} ETH
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

      {/* Actions */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {card.txError && (
          <div className="text-xs text-red-400/80 leading-snug">{card.txError}</div>
        )}
        {card.txSuccess && (
          <div className="text-xs text-emerald-400/80 leading-snug">{card.txSuccess}</div>
        )}

        {canClaim ? (
          <button
            onClick={handleClaim}
            disabled={card.claiming}
            className="w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all"
            style={{
              background: card.claiming ? "rgba(52,211,153,0.10)" : "rgba(52,211,153,0.15)",
              border: "1px solid rgba(52,211,153,0.30)",
              color: "#6ee7b7",
              opacity: card.claiming ? 0.6 : 1,
            }}
          >
            {card.claiming ? "Claiming" : "Claim Winnings"}
          </button>
        ) : isOpen ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.001 ETH"
              value={card.amount}
              onChange={(e) =>
                setCard((c) => ({ ...c, amount: e.target.value, txError: null }))
              }
              className="w-full bg-transparent rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.10)" }}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStake(0)}
                disabled={card.staking}
                className="py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all"
                style={{
                  background: card.staking ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  color: "#6ee7b7",
                  opacity: card.staking ? 0.5 : 1,
                }}
              >
                {card.staking ? "..." : "Higher"}
              </button>
              <button
                onClick={() => handleStake(1)}
                disabled={card.staking}
                className="py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all"
                style={{
                  background: card.staking ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.22)",
                  color: "#fca5a5",
                  opacity: card.staking ? 0.5 : 1,
                }}
              >
                {card.staking ? "..." : "Lower"}
              </button>
            </div>
          </>
        ) : isResolved && card.userStake && card.userStake.amount > 0n ? (
          <div className="text-xs text-white/30 text-center py-1">
            {card.userStake.claimed ? "Already claimed" : "Round resolved. No winnings."}
          </div>
        ) : (
          <div className="text-xs text-white/20 text-center py-1">
            {card.loading ? "" : "Round not active"}
          </div>
        )}

        {card.userStake && card.userStake.amount > 0n && isOpen && (
          <div className="text-[10px] text-white/30 text-center">
            Your stake: {formatEth(card.userStake.amount)} ETH on{" "}
            {card.userStake.direction === 0 ? "Higher" : "Lower"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

function PredictPage() {
  const [timeframe, setTimeframe] = useState<0 | 1>(0);
  const feed = useFeed();

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
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-tight mb-4">
              Predict what Ethereum does next.
            </h1>
            <p className="text-white/45 text-base leading-relaxed max-w-2xl">
              Stake ETH on whether each on-chain metric rises or falls at round close. Winners split the pool.
            </p>
          </div>

          <div
            className="flex items-center rounded-xl p-1 shrink-0 self-start sm:self-auto"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {([0, 1] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: timeframe === tf ? "rgba(255,255,255,0.10)" : "transparent",
                  color: timeframe === tf ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.35)",
                  border: timeframe === tf ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                }}
              >
                {tf === 0 ? "1H" : "24H"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACTIVE_METRICS.map((metric) => (
            <MetricCard
              key={`${metric}-${timeframe}`}
              metric={metric}
              timeframe={timeframe}
              feed={feed}
            />
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-6 text-[11px] text-white/30 uppercase tracking-widest">
          <span>Min stake 0.0001 ETH</span>
          <span>2% protocol fee</span>
          <span>Winners split the pool</span>
          <span>Rounds managed by keeper</span>
        </div>
      </div>
    </Layout>
  );
                  }
