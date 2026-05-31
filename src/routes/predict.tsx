import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import {
  FEED_LABELS,
  FEED_UNITS,
  FeedMetric,
  getMetricState,
  useNetworkFeed,
} from "@/lib/markets";
import { useWallet, connectWallet } from "@/lib/wallet";

export const Route = createFileRoute("/predict")({
  component: PredictPage,
  head: () => ({ meta: [{ title: "Predict — ChainFlux" }] }),
});

const PROXY = "0x7708a4C85F526E23090d3B27201487E91AF58694";

const PREDICT_ABI = [
  "function stake(uint256 roundId, uint8 direction) payable",
  "function claim(uint256 roundId)",
  "function rounds(uint256 roundId) view returns (uint256 id, uint8 metric, uint8 timeframe, uint256 startValue, uint256 endValue, uint256 openTime, uint256 closeTime, uint256 higherPool, uint256 lowerPool, uint8 status, uint8 result)",
  "function getUserStake(uint256 roundId, address user) view returns (uint256 amount, uint8 direction, bool claimed)",
  "function getLatestRound(uint8 metric, uint8 timeframe) view returns (uint256)",
];

const FEED_METRICS: FeedMetric[] = [
  "ACTIVE_ADDRESSES",
  "WHALE_TRANSFERS",
  "ETH_LARGE_TRANSFERS",
  "LIQUIDATION_VOLUME",
  "STABLES_MINTED_BURNED",
  "NEW_WALLET_CREATION",
  "BRIDGE_INFLOWS_OUTFLOWS",
  "DEX_VOLUME",
];

const METRIC_INDEX: Record<FeedMetric, number> = {
  ACTIVE_ADDRESSES: 0,
  WHALE_TRANSFERS: 1,
  ETH_LARGE_TRANSFERS: 2,
  LIQUIDATION_VOLUME: 3,
  STABLES_MINTED_BURNED: 4,
  NEW_WALLET_CREATION: 5,
  BRIDGE_INFLOWS_OUTFLOWS: 6,
  DEX_VOLUME: 7,
};

const STATE_DOT: Record<string, string> = {
  low: "#818cf8",
  medium: "#facc15",
  high: "#34d399",
};

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

const STATUS = { OPEN: 0, RESOLVED: 1, CANCELLED: 2 };

type RoundData = {
  roundId: bigint;
  metric: number;
  timeframe: number;
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

function formatValue(metric: string, value: number): string {
  if (value === 0) return "Quiet";
  if (metric === "ETH_LARGE_TRANSFERS" || metric === "BRIDGE_INFLOWS_OUTFLOWS")
    return value.toFixed(2);
  if (metric === "STABLES_MINTED_BURNED") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  }
  return value.toLocaleString();
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "0";
  if (eth < 0.0001) return "<0.0001";
  return eth.toFixed(4);
}

function formatCountdown(endTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const end = Number(endTime);
  const diff = end - now;
  if (diff <= 0) return "Closing";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function poolSplit(higher: bigint, lower: bigint): { higherPct: number; lowerPct: number } {
  const total = higher + lower;
  if (total === 0n) return { higherPct: 50, lowerPct: 50 };
  const h = Math.round((Number(higher) / Number(total)) * 100);
  return { higherPct: h, lowerPct: 100 - h };
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

async function getReadContract() {
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(
    "https://sepolia-rollup.arbitrum.io/rpc"
  );
  return new ethers.Contract(PROXY, PREDICT_ABI, provider);
}

async function getEthersContract() {
  const { ethers } = await import("ethers");
  if (!window.ethereum) throw new Error("No wallet");
  const provider = new ethers.BrowserProvider(window.ethereum as any);
  const signer = await provider.getSigner();
  return new ethers.Contract(PROXY, PREDICT_ABI, signer);
}

function useCountdown(endTime: bigint | undefined) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endTime) return "Loading";
  return formatCountdown(endTime);
}

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

function MetricCard({
  metric,
  timeframe,
  feedValue,
}: {
  metric: FeedMetric;
  timeframe: 0 | 1;
  feedValue: number;
}) {
  const wallet = useWallet();
  const state = getMetricState(metric, feedValue);
  const metricIndex = METRIC_INDEX[metric];

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
      const roundId: bigint = await contract.getLatestRound(metricIndex, timeframe);
      const raw = await contract.rounds(roundId);

      const round: RoundData = {
        roundId,
        metric: Number(raw[1]),
        timeframe: Number(raw[2]),
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
        userStake = {
          amount: us[0],
          direction: Number(us[1]),
          claimed: us[2],
        };
      }

      setCard((c) => ({ ...c, round, userStake, loading: false }));
    } catch (e: any) {
      console.error(`Load error ${metric}:`, e?.message);
      setCard((c) => ({ ...c, loading: false }));
    }
  }, [metricIndex, timeframe, wallet]);

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
      const contract = await getEthersContract();
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
      const contract = await getEthersContract();
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

  const totalPool =
    card.round ? card.round.higherPool + card.round.lowerPool : 0n;

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: STATE_DOT[state] }}
          />
          <div className="font-semibold text-white text-sm tracking-wide leading-tight truncate">
            {FEED_LABELS[metric]}
          </div>
        </div>
        <StateTag state={state} />
      </div>

      <div className="px-5 pb-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white/90 tabular-nums">
          {formatValue(metric, feedValue)}
        </span>
        <span className="text-xs text-white/30 uppercase tracking-widest">
          {FEED_UNITS[metric]}
        </span>
      </div>

      <div className="px-5 pb-3">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
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

      <div className="px-5 pb-4 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-white/30">
          {card.loading
            ? "Loading"
            : isOpen
            ? `Closes in ${countdown}`
            : isResolved
            ? "Resolved"
            : "Cancelled"}
        </div>
        {!card.loading && totalPool > 0n && (
          <div className="text-[10px] uppercase tracking-widest text-white/30">
            Pool {formatEth(totalPool)} ETH
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

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

function PredictPage() {
  const [timeframe, setTimeframe] = useState<0 | 1>(0);
  const feed = useNetworkFeed();

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
              Stake ETH on whether each onchain metric will be higher or lower at round close. Win a share of the pool.
            </p>
          </div>

          <div
            className="flex items-center rounded-xl p-1 shrink-0 self-start sm:self-auto"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {FEED_METRICS.map((metric) => (
            <MetricCard
              key={`${metric}-${timeframe}`}
              metric={metric}
              timeframe={timeframe}
              feedValue={feed[metric]}
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
