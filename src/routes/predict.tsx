import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
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

type ActiveMetric = "ACTIVE_ADDRESSES" | "GAS_PRICE" | "TXS_PER_BLOCK";

const ACTIVE_METRICS: ActiveMetric[] = ["ACTIVE_ADDRESSES", "GAS_PRICE", "TXS_PER_BLOCK"];

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

const METRIC_DESCRIPTION: Record<ActiveMetric, string> = {
  ACTIVE_ADDRESSES:
    "How many unique wallets are touching the chain right now. A surge means mass participation. A drop means people are sitting out. What happens next hour?",
  GAS_PRICE:
    "The cost of doing anything on Ethereum. When gas spikes, something big is happening. When it drops, the chain is quiet. Predict where it goes next.",
  TXS_PER_BLOCK:
    "How busy each Ethereum block is right now. High transaction counts mean the network is under pressure. Low counts mean things are calm. Which way is it heading?",
};

const QUESTION_BANK: Record<ActiveMetric, { bottom: string[]; middle: string[]; top: string[] }> = {
  GAS_PRICE: {
    bottom: ["Will gas rebound in {t}?", "Will gas recover in {t}?", "Will gas move higher in {t}?"],
    middle: ["Will gas be higher in {t}?", "Will gas move higher in {t}?", "Will gas trend higher in {t}?"],
    top: ["Will gas continue higher in {t}?", "Will gas stay higher in {t}?", "Will gas move higher in {t}?"],
  },
  TXS_PER_BLOCK: {
    bottom: ["Will transaction activity rebound in {t}?", "Will transaction activity recover in {t}?", "Will transaction activity move higher in {t}?"],
    middle: ["Will transactions per block be higher in {t}?", "Will transaction activity move higher in {t}?", "Will transaction activity trend higher in {t}?"],
    top: ["Will transaction activity continue higher in {t}?", "Will transaction activity stay higher in {t}?", "Will transaction activity move higher in {t}?"],
  },
  ACTIVE_ADDRESSES: {
    bottom: ["Will network activity rebound in {t}?", "Will network activity recover in {t}?", "Will network activity move higher in {t}?"],
    middle: ["Will active addresses be higher in {t}?", "Will network activity move higher in {t}?", "Will network activity trend higher in {t}?"],
    top: ["Will active addresses continue higher in {t}?", "Will active addresses stay higher in {t}?", "Will active addresses move higher in {t}?"],
  },
};

function getLockedQuestion(metric: ActiveMetric, roundId: bigint | undefined, position: number, timeframe: 0 | 1): string {
  const timeLabel = timeframe === 0 ? "1 hour" : "24 hours";
  const bank = QUESTION_BANK[metric];
  const pool = position <= 0.2 ? bank.bottom : position >= 0.8 ? bank.top : bank.middle;
  const lastKey = `cfq_last_${metric}`;
  let seed = roundId ? Number(roundId % BigInt(1000)) : Math.floor(Math.random() * 1000);
  const lastUsed = localStorage.getItem(lastKey);
  let idx = seed % pool.length;
  if (pool[idx] === lastUsed && pool.length > 1) idx = (idx + 1) % pool.length;
  const question = pool[idx];
  localStorage.setItem(lastKey, question);
  return question.replace("{t}", timeLabel);
}

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
  ACTIVE_ADDRESSES: 0, ACTIVE_DAILY_HIGH: 0, ACTIVE_DAILY_LOW: 0,
  GAS: 0, GAS_DAILY_HIGH: 0, GAS_DAILY_LOW: 0,
  TXS_PER_BLOCK: 0, TXS_DAILY_HIGH: 0, TXS_DAILY_LOW: 0, updatedAt: 0,
};

function useFeed() {
  const [feed, setFeed] = useState<FeedData>(EMPTY_FEED);
  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch(`${KEEPER_URL}/feed`);
        const data = await res.json();
        setFeed(data);
      } catch (e) { console.error("Feed fetch error:", e); }
    }
    fetchFeed();
    const id = setInterval(fetchFeed, 30_000);
    return () => clearInterval(id);
  }, []);
  return feed;
}

function getMetricValues(metric: ActiveMetric, feed: FeedData) {
  switch (metric) {
    case "ACTIVE_ADDRESSES": return { current: feed.ACTIVE_ADDRESSES, high: feed.ACTIVE_DAILY_HIGH, low: feed.ACTIVE_DAILY_LOW };
    case "GAS_PRICE": return { current: feed.GAS, high: feed.GAS_DAILY_HIGH, low: feed.GAS_DAILY_LOW };
    case "TXS_PER_BLOCK": return { current: feed.TXS_PER_BLOCK, high: feed.TXS_DAILY_HIGH, low: feed.TXS_DAILY_LOW };
  }
}

function formatValue(metric: ActiveMetric, value: number): string {
  if (value === 0) return "Loading";
  switch (metric) {
    case "GAS_PRICE": return value.toFixed(4);
    case "TXS_PER_BLOCK": return Math.round(value).toLocaleString();
    case "ACTIVE_ADDRESSES": return Math.round(value).toLocaleString();
  }
}

function formatContractValue(metric: ActiveMetric, raw: bigint): string {
  switch (metric) {
    case "GAS_PRICE": {
      const gwei = Number(raw) / 1e9;
      return gwei.toFixed(4) + " gwei";
    }
    case "TXS_PER_BLOCK":
      return Number(raw).toLocaleString() + " txs";
    case "ACTIVE_ADDRESSES":
      return Number(raw).toLocaleString() + " addresses";
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
  if (position > 0.65) return { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.28)", text: "rgba(110,231,183,0.95)", bar: "#34d399", label: "HIGH" };
  if (position > 0.35) return { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.28)", text: "rgba(253,224,71,0.95)", bar: "#facc15", label: "MID" };
  return { bg: "rgba(99,102,241,0.14)", border: "rgba(99,102,241,0.30)", text: "rgba(165,180,252,0.95)", bar: "#818cf8", label: "LOW" };
}

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

function useCountdown(endTime: bigint | undefined): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endTime) return "Loading";
  return formatCountdown(endTime);
}
// ---- History storage ----

type HistoryEntry = {
  metric: ActiveMetric;
  timeframe: 0 | 1;
  roundId: string;
  direction: number;
  amount: string;
  startValue: string;
  endValue: string;
  won: boolean;
  claimed: boolean;
  timestamp: number;
};

const HISTORY_KEY = "cfx_predict_history";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  const trimmed = entries.slice(-50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

function upsertHistory(entry: HistoryEntry) {
  const all = loadHistory();
  const idx = all.findIndex(
    (e) => e.roundId === entry.roundId && e.metric === entry.metric && e.timeframe === entry.timeframe
  );
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  saveHistory(all);
}

// ---- Component ----

const STATUS = { OPEN: 0, RESOLVED: 1, CANCELLED: 2 };

type RoundData = {
  roundId: bigint;
  startValue: bigint;
  endValue: bigint;
  higherPool: bigint;
  lowerPool: bigint;
  status: number;
  result: number;
  startTime: bigint;
  endTime: bigint;
};

type UserStake = { amount: bigint; direction: number; claimed: boolean; };

type CardState = {
  round: RoundData | null;
  userStake: UserStake | null;
  loading: boolean;
  staking: boolean;
  claiming: boolean;
  txError: string | null;
  txSuccess: string | null;
  amount: string;
  // Previous resolved round for result display
  prevRound: RoundData | null;
  prevUserStake: UserStake | null;
};

function MetricCard({ metric, timeframe, feed, onHistoryUpdate }: {
  metric: ActiveMetric;
  timeframe: 0 | 1;
  feed: FeedData;
  onHistoryUpdate: () => void;
}) {
  const wallet = useWallet();
  const contractId = METRIC_CONTRACT_ID[metric];
  const { current, high, low } = getMetricValues(metric, feed);
  const range = high - low;
  const position = range > 0 ? (current - low) / range : 0.5;
  const color = getActivityColor(position);
  const [expanded, setExpanded] = useState(false);

  const [card, setCard] = useState<CardState>({
    round: null, userStake: null, loading: true, staking: false,
    claiming: false, txError: null, txSuccess: null, amount: "",
    prevRound: null, prevUserStake: null,
  });

  const questionRef = useRef<string>("");
  const lastRoundIdRef = useRef<string>("");
  const roundIdStr = card.round?.roundId?.toString() ?? "";
  if (roundIdStr !== lastRoundIdRef.current) {
    lastRoundIdRef.current = roundIdStr;
    questionRef.current = getLockedQuestion(metric, card.round?.roundId, position, timeframe);
  }
  const question = questionRef.current || getLockedQuestion(metric, undefined, position, timeframe);
  const countdown = useCountdown(card.round?.endTime);

  const load = useCallback(async () => {
    try {
      const contract = await getReadContract();
      const latestId: bigint = await contract.getLatestRound(contractId, timeframe);
      const raw = await contract.rounds(latestId);
      const round: RoundData = {
        roundId: latestId,
        startValue: raw[3],
        endValue: raw[4],
        higherPool: raw[7],
        lowerPool: raw[8],
        status: Number(raw[9]),
        result: Number(raw[10]),
        startTime: raw[5],
        endTime: raw[6],
      };

      let userStake: UserStake | null = null;
      if (wallet) {
        const us = await contract.getUserStake(latestId, wallet);
        userStake = { amount: us[0], direction: Number(us[1]), claimed: us[2] };
      }

      // Always check previous round too — this is the key fix.
      // When a round resolves, keeper opens a new round immediately.
      // So latestId is the NEW round, and the user's stake is on latestId - 1.
      let prevRound: RoundData | null = null;
      let prevUserStake: UserStake | null = null;

      if (wallet && latestId > 1n) {
        try {
          const prevId = latestId - 1n;
          const prevRaw = await contract.rounds(prevId);
          const prevStatus = Number(prevRaw[9]);

          // Only care about the previous round if it's resolved
          if (prevStatus === STATUS.RESOLVED) {
            prevRound = {
              roundId: prevId,
              startValue: prevRaw[3],
              endValue: prevRaw[4],
              higherPool: prevRaw[7],
              lowerPool: prevRaw[8],
              status: prevStatus,
              result: Number(prevRaw[10]),
              startTime: prevRaw[5],
              endTime: prevRaw[6],
            };
            const pus = await contract.getUserStake(prevId, wallet);
            if (pus[0] > 0n) {
              prevUserStake = { amount: pus[0], direction: Number(pus[1]), claimed: pus[2] };

              // Save to history
              const won = prevRound.result === prevUserStake.direction;
              const entry: HistoryEntry = {
                metric,
                timeframe,
                roundId: prevId.toString(),
                direction: prevUserStake.direction,
                amount: formatEth(prevUserStake.amount),
                startValue: prevRound.startValue.toString(),
                endValue: prevRound.endValue.toString(),
                won,
                claimed: prevUserStake.claimed,
                timestamp: Number(prevRound.endTime),
              };
              upsertHistory(entry);
              onHistoryUpdate();
            }
          }
        } catch (e) {
          // Previous round check is best-effort
        }
      }

      // Also save current round to history if it's resolved and user has stake
      if (wallet && userStake && userStake.amount > 0n && round.status === STATUS.RESOLVED) {
        const won = round.result === userStake.direction;
        const entry: HistoryEntry = {
          metric,
          timeframe,
          roundId: latestId.toString(),
          direction: userStake.direction,
          amount: formatEth(userStake.amount),
          startValue: round.startValue.toString(),
          endValue: round.endValue.toString(),
          won,
          claimed: userStake.claimed,
          timestamp: Number(round.endTime),
        };
        upsertHistory(entry);
        onHistoryUpdate();
      }

      setCard((c) => ({ ...c, round, userStake, prevRound, prevUserStake, loading: false }));
    } catch (e: any) {
      console.error(`Load error ${metric}:`, e?.message);
      setCard((c) => ({ ...c, loading: false }));
    }
  }, [contractId, timeframe, wallet, metric, onHistoryUpdate]);

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
      setCard((c) => ({ ...c, staking: false, txSuccess: `Staked ${amtStr} ETH on ${direction === 0 ? "Higher" : "Lower"}`, amount: "" }));
      load();
    } catch (e: any) {
      setCard((c) => ({ ...c, staking: false, txError: e?.reason || e?.message || "Transaction failed" }));
    }
                             }
    async function handleClaim(roundId: bigint) {
    if (!wallet) return;
    setCard((c) => ({ ...c, claiming: true, txError: null, txSuccess: null }));
    try {
      const contract = await getWriteContract();
      const tx = await contract.claim(roundId);
      await tx.wait();
      const all = loadHistory();
      const idx = all.findIndex(
        (e) => e.roundId === roundId.toString() && e.metric === metric && e.timeframe === timeframe
      );
      if (idx >= 0) {
        all[idx].claimed = true;
        saveHistory(all);
        onHistoryUpdate();
      }
      setCard((c) => ({ ...c, claiming: false, txSuccess: "Winnings claimed!" }));
      load();
    } catch (e: any) {
      setCard((c) => ({ ...c, claiming: false, txError: e?.reason || e?.message || "Claim failed" }));
    }
  }

  const { higherPct, lowerPct } = card.round
    ? poolSplit(card.round.higherPool, card.round.lowerPool)
    : { higherPct: 50, lowerPct: 50 };

  const isOpen = card.round?.status === STATUS.OPEN;
  const isResolved = card.round?.status === STATUS.RESOLVED;
  const totalPool = card.round ? card.round.higherPool + card.round.lowerPool : 0n;
  const hasUserStake = card.userStake && card.userStake.amount > 0n;

  // Current round result
  const showCurrentResult = isResolved && hasUserStake && card.round;
  const currentUserWon = showCurrentResult ? card.round!.result === card.userStake!.direction : false;
  const canClaimCurrent = showCurrentResult && !card.userStake!.claimed;

  // Previous round result (main fix — shows result when new round already opened)
  const showPrevResult = !showCurrentResult && card.prevRound && card.prevUserStake && card.prevUserStake.amount > 0n;
  const prevUserWon = showPrevResult ? card.prevRound!.result === card.prevUserStake!.direction : false;
  const canClaimPrev = showPrevResult && !card.prevUserStake!.claimed;

  return (
    <div
      className="rounded-2xl w-full overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Top row */}
      <div className="px-6 pt-7 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full shrink-0"
            style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
          >
            {color.label}
          </span>
          <span className="font-bold text-white text-lg tracking-tight truncate">
            {METRIC_LABEL[metric]}
          </span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-4xl font-bold text-white tabular-nums">
            {formatValue(metric, current)}
          </span>
          <span className="text-xs text-white/30 uppercase tracking-widest">
            {METRIC_UNIT[metric]}
          </span>
        </div>
      </div>
      {/* Daily range bar */}
      {high > 0 && (
        <div className="px-6 pb-5">
          <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/25 mb-2">
            <span>Low {metric === "GAS_PRICE" ? low.toFixed(2) : Math.round(low).toLocaleString()}</span>
            <span>High {metric === "GAS_PRICE" ? high.toFixed(2) : Math.round(high).toLocaleString()}</span>
          </div>
          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(2, position * 100))}%`, background: `linear-gradient(90deg, #818cf8, ${color.bar})` }}
            />
          </div>
        </div>
      )}

      {/* Question */}
      <div className="px-6 pb-4">
        <p className="text-white text-lg leading-snug font-semibold">
          {question}
        </p>
      </div>

      {/* Tap to reveal */}
      <div className="px-6 pb-5">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-[11px] uppercase tracking-widest transition-colors"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          <span>{expanded ? "Hide" : "What is this?"}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {expanded && (
          <p className="mt-3 text-sm text-white/45 leading-relaxed">
            {METRIC_DESCRIPTION[metric]}
          </p>
        )}
      </div>

      {/* Pool split */}
      <div className="px-6 pb-5">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/30 mb-2">
          <span>Higher {higherPct}%</span>
          <span>Lower {lowerPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${higherPct}%`, background: "linear-gradient(90deg, #34d399, #818cf8)" }}
          />
        </div>
      </div>

      {/* Status row */}
      <div className="px-6 pb-5 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-white/30">
          {card.loading ? "Loading" : isOpen ? `Closes ${countdown}` : isResolved ? "Resolved" : "Inactive"}
        </div>
        {!card.loading && totalPool > 0n && (
          <div className="text-[10px] uppercase tracking-widest text-white/30">
            Pool {formatEth(totalPool)} ETH
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Actions */}
      <div className="px-6 py-6 flex flex-col gap-3">
        {card.txError && <div className="text-xs text-red-400/80 leading-snug">{card.txError}</div>}
        {card.txSuccess && <div className="text-xs text-emerald-400/80 leading-snug">{card.txSuccess}</div>}

        {/* Previous round result — shown when new round already opened */}
        {showPrevResult && (
          <div
            className="rounded-xl px-5 py-4 flex flex-col gap-2"
            style={{
              background: prevUserWon ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${prevUserWon ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.22)"}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: prevUserWon ? "#6ee7b7" : "#fca5a5" }}
              >
                {prevUserWon ? "You Won" : "You Lost"} — Previous Round
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/30">Round closed</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Your call</span>
                <span style={{ color: card.prevUserStake!.direction === 0 ? "#6ee7b7" : "#fca5a5" }}>
                  {card.prevUserStake!.direction === 0 ? "Higher" : "Lower"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Entry value</span>
                <span className="text-white/70 tabular-nums">
                  {formatContractValue(metric, card.prevRound!.startValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Close value</span>
                <span className="text-white/70 tabular-nums">
                  {formatContractValue(metric, card.prevRound!.endValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Staked</span>
                <span className="text-white/70 tabular-nums">{formatEth(card.prevUserStake!.amount)} ETH</span>
              </div>
            </div>
            {canClaimPrev && (
              <button
                onClick={() => handleClaim(card.prevRound!.roundId)}
                disabled={card.claiming}
                className="mt-2 w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all"
                style={{
                  background: card.claiming ? "rgba(52,211,153,0.10)" : "rgba(52,211,153,0.15)",
                  border: "1px solid rgba(52,211,153,0.30)",
                  color: "#6ee7b7",
                  opacity: card.claiming ? 0.6 : 1,
                }}
              >
                {card.claiming ? "Claiming" : "Claim Winnings"}
              </button>
            )}
          </div>
        )}

        {/* Current round result */}
        {showCurrentResult && (
          <div
            className="rounded-xl px-5 py-4 flex flex-col gap-2"
            style={{
              background: currentUserWon ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${currentUserWon ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.22)"}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: currentUserWon ? "#6ee7b7" : "#fca5a5" }}
              >
                {currentUserWon ? "You Won" : "You Lost"}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/30">Round closed</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Your call</span>
                <span style={{ color: card.userStake!.direction === 0 ? "#6ee7b7" : "#fca5a5" }}>
                  {card.userStake!.direction === 0 ? "Higher" : "Lower"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Entry value</span>
                <span className="text-white/70 tabular-nums">
                  {formatContractValue(metric, card.round!.startValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Close value</span>
                <span className="text-white/70 tabular-nums">
                  {formatContractValue(metric, card.round!.endValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Staked</span>
                <span className="text-white/70 tabular-nums">{formatEth(card.userStake!.amount)} ETH</span>
              </div>
            </div>
            {canClaimCurrent && (
              <button
                onClick={() => handleClaim(card.round!.roundId)}
                disabled={card.claiming}
                className="mt-2 w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all"
                style={{
                  background: card.claiming ? "rgba(52,211,153,0.10)" : "rgba(52,211,153,0.15)",
                  border: "1px solid rgba(52,211,153,0.30)",
                  color: "#6ee7b7",
                  opacity: card.claiming ? 0.6 : 1,
                }}
              >
                {card.claiming ? "Claiming" : "Claim Winnings"}
              </button>
            )}
          </div>
        )}
         {hasUserStake && isOpen && (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-[11px] uppercase tracking-widest text-white/40">Your position</span>
            <span className="text-sm font-semibold" style={{ color: card.userStake!.direction === 0 ? "#6ee7b7" : "#fca5a5" }}>
              {formatEth(card.userStake!.amount)} ETH on {card.userStake!.direction === 0 ? "Higher" : "Lower"}
            </span>
          </div>
        )}

        {isOpen ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.001 ETH"
              value={card.amount}
              onChange={(e) => setCard((c) => ({ ...c, amount: e.target.value, txError: null }))}
              className="w-full bg-transparent rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStake(0)}
                disabled={card.staking}
                className="py-4 rounded-xl text-sm font-bold tracking-wide transition-all"
                style={{
                  background: card.staking ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0.15)",
                  border: "1px solid rgba(52,211,153,0.30)",
                  color: "#6ee7b7",
                  opacity: card.staking ? 0.5 : 1,
                }}
              >
                {card.staking ? "..." : "Higher"}
              </button>
              <button
                onClick={() => handleStake(1)}
                disabled={card.staking}
                className="py-4 rounded-xl text-sm font-bold tracking-wide transition-all"
                style={{
                  background: card.staking ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.28)",
                  color: "#fca5a5",
                  opacity: card.staking ? 0.5 : 1,
                }}
              >
                {card.staking ? "..." : "Lower"}
              </button>
            </div>
          </>
        ) : !showCurrentResult && !showPrevResult && (
          <div className="text-xs text-white/20 text-center py-1">
            {card.loading ? "" : "Round not active"}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- History panel ----

const TIMEFRAME_LABEL = ["1H", "24H"];

function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-white tracking-tight mb-5">Your History</h2>
      <div className="flex flex-col gap-3">
        {sorted.map((e) => {
          const won = e.won;
          const date = new Date(e.timestamp * 1000);
          const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const startBig = BigInt(e.startValue);
          const endBig = BigInt(e.endValue);
          const startFmt = formatContractValue(e.metric, startBig);
          const endFmt = formatContractValue(e.metric, endBig);

          return (
            <div
              key={`${e.metric}-${e.timeframe}-${e.roundId}`}
              className="rounded-xl px-5 py-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${won ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.15)"}`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{
                      background: won ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.10)",
                      color: won ? "#6ee7b7" : "#fca5a5",
                    }}
                  >
                    {won ? "Won" : "Lost"}
                  </span>
                  <span className="text-sm font-semibold text-white/80">{METRIC_LABEL[e.metric]}</span>
                  <span className="text-[10px] text-white/30 uppercase tracking-widest">{TIMEFRAME_LABEL[e.timeframe]}</span>
                </div>
                <span className="text-[10px] text-white/25 tabular-nums">{dateStr} {timeStr}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Your call</div>
                  <div className="text-xs font-semibold" style={{ color: e.direction === 0 ? "#6ee7b7" : "#fca5a5" }}>
                    {e.direction === 0 ? "Higher" : "Lower"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Entry</div>
                  <div className="text-xs text-white/70 tabular-nums">{startFmt}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Close</div>
                  <div className="text-xs text-white/70 tabular-nums">{endFmt}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Staked</div>
                  <div className="text-xs text-white/70 tabular-nums">{e.amount} ETH</div>
                </div>
              </div>
              {won && !e.claimed && (
                <div className="mt-3 text-[10px] text-emerald-400/60 uppercase tracking-widest">
                  Unclaimed winnings — claim above
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
              }
// ---- Page ----
function PredictPage() {
  const [timeframe, setTimeframe] = useState<0 | 1>(0);
  const feed = useFeed();
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  return (
    <Layout>
      <div className="fixed inset-0 pointer-events-none" style={{ background: "#000000" }} />

      <div className="relative z-10 pt-32 pb-24 mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Predict what Ethereum does next.
            </h1>
            <p className="text-white/45 text-base leading-relaxed max-w-2xl">
              Stake ETH on whether each on-chain metric rises or falls at round close. Winners split the pool.
            </p>
          </div>

          <div
            className="flex items-center rounded-xl p-1 shrink-0 self-start sm:self-auto"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {([0, 1] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: timeframe === tf ? "rgba(255,255,255,0.12)" : "transparent",
                  color: timeframe === tf ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
                  border: timeframe === tf ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                }}
              >
                {tf === 0 ? "1H" : "24H"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {ACTIVE_METRICS.map((metric) => (
            <MetricCard
              key={`${metric}-${timeframe}`}
              metric={metric}
              timeframe={timeframe}
              feed={feed}
              onHistoryUpdate={refreshHistory}
            />
          ))}
        </div>

        <HistoryPanel entries={history} />
      </div>
    </Layout>
  );
      }
