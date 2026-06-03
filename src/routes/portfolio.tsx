import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { MARKET_LABELS } from "@/lib/markets";
import { useMarket } from "@/lib/markets";
import { closePosition, pnl, usePositions } from "@/lib/positions";
import type { Market } from "@/lib/positions";
import { useWallet, connectWallet, shortAddr } from "@/lib/wallet";
import { ethers } from "ethers";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({ meta: [{ title: "Portfolio — ChainFlux" }] }),
});

const PREDICT_PROXY = "0x7708a4C85F526E23090d3B27201487E91AF58694";
const PREDICT_ABI = [
  "function stake(uint256 roundId, uint8 direction) payable",
  "function claim(uint256 roundId)",
  "function rounds(uint256 roundId) view returns (uint256 id, uint8 metric, uint8 timeframe, uint256 startValue, uint256 endValue, uint256 openTime, uint256 closeTime, uint256 higherPool, uint256 lowerPool, uint8 status, uint8 result)",
  "function getUserStake(uint256 roundId, address user) view returns (uint256 amount, uint8 direction, bool claimed)",
  "function getLatestRound(uint8 metric, uint8 timeframe) view returns (uint256)",
];

type PredictSlot = { contractId: number; label: string; timeframe: 0 | 1; tfLabel: string };

const PREDICT_SLOTS: PredictSlot[] = [
  { contractId: 0, label: "Active Addresses", timeframe: 0, tfLabel: "1H" },
  { contractId: 0, label: "Active Addresses", timeframe: 1, tfLabel: "24H" },
  { contractId: 2, label: "Gas Price", timeframe: 0, tfLabel: "1H" },
  { contractId: 2, label: "Gas Price", timeframe: 1, tfLabel: "24H" },
  { contractId: 3, label: "Txs Per Block", timeframe: 0, tfLabel: "1H" },
  { contractId: 3, label: "Txs Per Block", timeframe: 1, tfLabel: "24H" },
];

type PredictRow = {
  roundId: bigint;
  slot: PredictSlot;
  status: number;
  result: number;
  startValue: bigint;
  endValue: bigint;
  closeTime: bigint;
  higherPool: bigint;
  lowerPool: bigint;
  userAmount: bigint;
  userDirection: number;
  userClaimed: boolean;
};

const PREDICT_HISTORY_KEY = "cf_predict_history_v2";

type HistoryEntry = {
  roundId: string;
  metric: string;
  timeframe: 0 | 1;
  direction: number;
  amount: string;
  startValue: string;
  endValue: string;
  status: number;
  result: number;
  claimed: boolean;
  closeTime: number;
  savedAt: number;
};

const SLOT_BY_METRIC: Record<string, PredictSlot[]> = {
  ACTIVE_ADDRESSES: [
    { contractId: 0, label: "Active Addresses", timeframe: 0, tfLabel: "1H" },
    { contractId: 0, label: "Active Addresses", timeframe: 1, tfLabel: "24H" },
  ],
  GAS_PRICE: [
    { contractId: 2, label: "Gas Price", timeframe: 0, tfLabel: "1H" },
    { contractId: 2, label: "Gas Price", timeframe: 1, tfLabel: "24H" },
  ],
  TXS_PER_BLOCK: [
    { contractId: 3, label: "Txs Per Block", timeframe: 0, tfLabel: "1H" },
    { contractId: 3, label: "Txs Per Block", timeframe: 1, tfLabel: "24H" },
  ],
};

function loadCachedHistory(): PredictRow[] {
  try {
    const raw = localStorage.getItem(PREDICT_HISTORY_KEY);
    if (!raw) return [];
    const entries: HistoryEntry[] = JSON.parse(raw);
    return entries.map((e) => {
      const slots = SLOT_BY_METRIC[e.metric] ?? [];
      const slot = slots.find((s) => s.timeframe === e.timeframe) ?? slots[0] ?? PREDICT_SLOTS[0];
      return {
        roundId: BigInt(e.roundId),
        slot,
        status: e.status,
        result: e.result,
        startValue: BigInt(e.startValue),
        endValue: BigInt(e.endValue),
        closeTime: BigInt(e.closeTime),
        higherPool: 0n,
        lowerPool: 0n,
        userAmount: BigInt(e.amount),
        userDirection: e.direction,
        userClaimed: e.claimed,
      };
    });
  } catch { return []; }
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

function formatMetricValue(slot: PredictSlot, raw: bigint): string {
  if (raw === 0n) return "—";
  if (slot.contractId === 2) {
    return (Number(raw) / 1e9).toFixed(4) + " gwei";
  }
  if (slot.contractId === 3) {
    return Math.round(Number(raw) / 100).toLocaleString() + " txs";
  }
  if (raw > 1_000_000_000_000n) return Math.round(Number(raw) / 1e18).toLocaleString() + " addresses";
  return Number(raw).toLocaleString() + " addresses";
}

const LOOKBACK = 20;

async function fetchAllPredictRows(wallet: string, contract: ethers.Contract): Promise<PredictRow[]> {
  const allRows: PredictRow[] = [];

  await Promise.all(
    PREDICT_SLOTS.map(async (slot) => {
      try {
        const latestId: bigint = await contract.getLatestRound(slot.contractId, slot.timeframe);
        const minId = latestId > BigInt(LOOKBACK) ? latestId - BigInt(LOOKBACK) : 1n;

        const checks: Promise<void>[] = [];
        for (let id = latestId; id >= minId; id--) {
          const roundId = id;
          checks.push(
            (async () => {
              try {
                const us = await contract.getUserStake(roundId, wallet);
                const userAmount: bigint = us[0];
                if (userAmount === 0n) return;
                const raw = await contract.rounds(roundId);
// raw[1] = metric, raw[2] = timeframe — validate they match this slot
const roundMetric = Number(raw[1]);
const roundTimeframe = Number(raw[2]);
if (roundMetric !== slot.contractId || roundTimeframe !== slot.timeframe) return;
allRows.push({
  roundId,
  slot,
  status: Number(raw[9]),
  result: Number(raw[10]),
  startValue: raw[3],
  endValue: raw[4],
  closeTime: raw[6],
  higherPool: raw[7],
  lowerPool: raw[8],
  userAmount,
  userDirection: Number(us[1]),
  userClaimed: us[2],
});
              } catch { /* skip */ }
            })()
          );
        }
        await Promise.all(checks);
      } catch { /* skip slot */ }
    })
  );

  return allRows.sort((a, b) => {
    if (a.status === 0 && b.status !== 0) return -1;
    if (a.status !== 0 && b.status === 0) return 1;
    return Number(b.closeTime) - Number(a.closeTime);
  });
}

function usePredictRows(wallet: string | null | undefined) {
  const [rows, setRows] = useState<PredictRow[]>(() => loadCachedHistory());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) { setRows([]); return; }
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
      const contract = new ethers.Contract(PREDICT_PROXY, PREDICT_ABI, provider);
      const result = await fetchAllPredictRows(wallet, contract);
      const cached = loadCachedHistory();
      const onChainIds = new Set(result.map((r) => `${r.roundId}-${r.slot.contractId}-${r.slot.timeframe}`));
      const cachedOnly = cached.filter(
        (c) => !onChainIds.has(`${c.roundId}-${c.slot.contractId}-${c.slot.timeframe}`)
      );
      const merged = [...result, ...cachedOnly].sort((a, b) => {
        if (a.status === 0 && b.status !== 0) return -1;
        if (a.status !== 0 && b.status === 0) return 1;
        return Number(b.closeTime) - Number(a.closeTime);
      });
      setRows(merged);
    } catch (e) {
      console.error("Predict rows error:", e);
      setRows(loadCachedHistory());
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return { rows, loading, reload: load };
}

function PortfolioPage() {
  const wallet = useWallet();
  const { open, hist } = usePositions(wallet);
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");
  const price = (m: Market) => m === "GAS" ? gas.current : txs.current;
  const { rows: predictRows, loading: predictLoading, reload: reloadPredict } = usePredictRows(wallet);

  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedRows, setClaimedRows] = useState<Set<string>>(new Set());

  const now = Math.floor(Date.now() / 1000);
  const openPredicts = predictRows.filter((r) => r.status === 0 && Number(r.closeTime) > now);
  const pendingPredicts = predictRows.filter((r) => r.status === 0 && Number(r.closeTime) <= now);
  const historyPredicts = predictRows.filter((r) => r.status !== 0);

  const handleClaim = async (roundId: bigint) => {
    const key = roundId.toString();
    setClaiming(key);
    setClaimError(null);
    try {
      if (!window.ethereum) throw new Error("No wallet");
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PREDICT_PROXY, PREDICT_ABI, signer);
      const tx = await contract.claim(roundId);
      await tx.wait();
      // Mark as claimed locally immediately so UI updates without waiting for reload
      setClaimedRows((prev) => new Set([...prev, key]));
      await reloadPredict();
    } catch (e: any) {
      setClaimError(e?.reason || e?.message || "Claim failed");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <Layout>
      <div className="pt-32 pb-20 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.3em] text-white/40 uppercase">Portfolio</div>
            <h1 className="mt-5 text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.05]">Your positions.</h1>
          </div>
          {wallet ? (
            <span className="text-sm text-white/60 font-mono glass rounded-full px-4 py-2">{shortAddr(wallet)}</span>
          ) : (
            <button onClick={() => connectWallet()} className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90">
              Connect Wallet
            </button>
          )}
        </div>

        {/* Open perp positions */}
        <h2 className="mt-14 text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Positions</h2>
        <div className="mt-4 glass rounded-2xl overflow-hidden">
          {open.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              No open positions yet. Head to <Link to="/trade" className="text-white underline-offset-4 hover:underline">Trade</Link> to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Market</th>
                    <th className="text-left p-4">Direction</th>
                    <th className="text-left p-4">Leverage</th>
                    <th className="text-right p-4">Collateral</th>
                    <th className="text-right p-4">Entry</th>
                    <th className="text-right p-4">Liq. Price</th>
                    <th className="text-right p-4">Current</th>
                    <th className="text-right p-4">PnL</th>
                    <th className="text-right p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((p, i) => {
                    const cur = price(p.market);
                    const v = pnl(p, cur);
                    const moveToLiq = 0.8 / p.leverage;
                    const liqPrice = p.direction === "LONG"
                      ? p.entryPrice * (1 - moveToLiq)
                      : p.entryPrice * (1 + moveToLiq);
                    return (
                      <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white">{MARKET_LABELS[p.market] ?? p.market}</td>
                        <td className={`p-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>{p.direction}</td>
                        <td className="p-4 text-white/70">{p.leverage}×</td>
                        <td className="p-4 text-right text-white tabular-nums">{p.collateral.toFixed(4)} ETH</td>
                        <td className="p-4 text-right text-white/80 tabular-nums">{p.entryPrice.toFixed(4)}</td>
                        <td className="p-4 text-right text-red-300 tabular-nums">{liqPrice.toFixed(4)}</td>
                        <td className="p-4 text-right text-white tabular-nums">{isFinite(cur) ? cur.toFixed(4) : "—"}</td>
                        <td className={`p-4 text-right tabular-nums ${v >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {isFinite(v) ? `${v.toFixed(4)} ETH` : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => closePosition(p.id, cur)} className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10">
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

       {/* Open predict positions */}
        <h2 className="mt-14 text-[10px] tracking-[0.3em] text-white/50 uppercase">Predict Positions</h2>
        <div className="mt-4 glass rounded-2xl overflow-hidden">
          {!wallet ? (
            <div className="p-6 text-sm text-white/60">Connect your wallet to see your predictions.</div>
          ) : predictLoading && openPredicts.length === 0 && pendingPredicts.length === 0 ? (
            <div className="p-6 text-sm text-white/40">Loading predictions...</div>
          ) : openPredicts.length === 0 && pendingPredicts.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              No predict positions yet. Head to <Link to="/predict" className="text-white underline-offset-4 hover:underline">Predict</Link> to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Metric</th>
                    <th className="text-left p-4">TF</th>
                    <th className="text-left p-4">Your Call</th>
                    <th className="text-right p-4">Entry Value</th>
                    <th className="text-right p-4">Staked</th>
                    <th className="text-right p-4">Pool</th>
                    <th className="text-right p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...openPredicts, ...pendingPredicts].map((row, i) => {
                    const totalPool = row.higherPool + row.lowerPool;
                    const isPending = row.status === 0 && Number(row.closeTime) <= now;
                    return (
                      <tr key={`${row.roundId}-${row.slot.contractId}-${row.slot.timeframe}`} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white font-medium">{row.slot.label}</td>
                        <td className="p-4">
                          <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                            {row.slot.tfLabel}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={row.userDirection === 0 ? "text-emerald-300" : "text-red-300"}>
                            {row.userDirection === 0 ? "Higher" : "Lower"}
                          </span>
                        </td>
                        <td className="p-4 text-right text-white/70 tabular-nums">
                          {formatMetricValue(row.slot, row.startValue)}
                        </td>
                        <td className="p-4 text-right text-white tabular-nums">{formatEth(row.userAmount)} ETH</td>
                        <td className="p-4 text-right text-white/50 tabular-nums">
                          {totalPool > 0n ? formatEth(totalPool) + " ETH" : "—"}
                        </td>
                        <td className="p-4 text-right text-white/50 tabular-nums">
                          {isPending ? (
                            <span className="text-yellow-400/70 text-xs">Awaiting result</span>
                          ) : (
                            <span className="text-emerald-300/70 text-xs tabular-nums">
                              Closes {formatCountdown(row.closeTime)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Trade history */}
        <h2 className="mt-14 text-[10px] tracking-[0.3em] text-white/50 uppercase">Trade History</h2>
        <div className="mt-4 glass rounded-2xl overflow-hidden">
          {hist.length === 0 ? (
            <div className="p-6 text-sm text-white/60">No trade history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Market</th>
                    <th className="text-left p-4">Direction</th>
                    <th className="text-left p-4">Leverage</th>
                    <th className="text-right p-4">Collateral</th>
                    <th className="text-right p-4">Entry</th>
                    <th className="text-right p-4">Close</th>
                    <th className="text-right p-4">PnL</th>
                    <th className="text-right p-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map((p, i) => {
                    const closePrice = typeof p.closePrice === "number" && isFinite(p.closePrice)
                      ? p.closePrice
                      : p.entryPrice;
                    const v = pnl(p, closePrice);
                    return (
                      <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white">{MARKET_LABELS[p.market] ?? p.market}</td>
                        <td className={`p-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>{p.direction}</td>
                        <td className="p-4 text-white/70">{p.leverage}×</td>
                        <td className="p-4 text-right text-white tabular-nums">{p.collateral.toFixed(4)} ETH</td>
                        <td className="p-4 text-right text-white/80 tabular-nums">{p.entryPrice.toFixed(4)}</td>
                        <td className="p-4 text-right text-white/80 tabular-nums">{closePrice.toFixed(4)}</td>
                        <td className={`p-4 text-right tabular-nums ${v >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {isFinite(v) ? `${v.toFixed(4)} ETH` : "—"}
                        </td>
                        <td className="p-4 text-right text-white/60">
                          {p.closedAt ? new Date(p.closedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Predict history */}
        <h2 className="mt-14 text-[10px] tracking-[0.3em] text-white/50 uppercase">Predict History</h2>
        <div className="mt-4 glass rounded-2xl overflow-hidden">
          {!wallet ? (
            <div className="p-6 text-sm text-white/60">Connect your wallet to see your predict history.</div>
          ) : predictLoading && historyPredicts.length === 0 ? (
            <div className="p-6 text-sm text-white/40">Loading history...</div>
          ) : historyPredicts.length === 0 ? (
            <div className="p-6 text-sm text-white/60">No predict history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              {claimError && (
                <div className="px-5 py-3 text-xs text-red-400/80 border-b border-white/5">{claimError}</div>
              )}
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Metric</th>
                    <th className="text-left p-4">TF</th>
                    <th className="text-left p-4">Your Call</th>
                    <th className="text-right p-4">Entry Value</th>
                    <th className="text-right p-4">Close Value</th>
                    <th className="text-right p-4">Staked</th>
                    <th className="text-right p-4">Result</th>
                    <th className="text-right p-4">Date</th>
                    <th className="text-right p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {historyPredicts.map((row, i) => {
                    const key = `${row.roundId}-${row.slot.contractId}-${row.slot.timeframe}`;
                    const isResolved = row.status === 1;
                    const isCancelled = row.status === 2;

                    // result: 0 = Higher won, 1 = Lower won (only valid when isResolved)
// Cancelled rounds: no winner, stake should ideally be refunded by contract
// Only show Won/Lost for truly resolved rounds
const userWon = isResolved && row.userDirection === row.result;
const userLost = isResolved && !userWon;
const wasCancelled = isCancelled;
                    const justClaimed = claimedRows.has(row.roundId.toString());
                    const canClaim = userWon && !row.userClaimed && !justClaimed;
                    const alreadyClaimed = userWon && (row.userClaimed || justClaimed);

                    const closeDate = new Date(Number(row.closeTime) * 1000);
                    const dateStr = closeDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    const timeStr = closeDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

                    return (
                      <tr key={key} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white font-medium">{row.slot.label}</td>
                        <td className="p-4">
                          <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                            {row.slot.tfLabel}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={row.userDirection === 0 ? "text-emerald-300" : "text-red-300"}>
                            {row.userDirection === 0 ? "Higher" : "Lower"}
                          </span>
                        </td>
                        <td className="p-4 text-right text-white/70 tabular-nums">
                          {formatMetricValue(row.slot, row.startValue)}
                        </td>
                        <td className="p-4 text-right text-white/70 tabular-nums">
                          {row.endValue > 0n ? formatMetricValue(row.slot, row.endValue) : "—"}
                        </td>
                        <td className="p-4 text-right text-white tabular-nums">{formatEth(row.userAmount)} ETH</td>
                        <td className="p-4 text-right">
                          {userWon ? (
                            <span className="text-emerald-300 font-semibold">
                              {alreadyClaimed ? "Won" : "Won"}
                            </span>
                          ) : userLost ? (
  <span className="text-red-300/70 font-semibold">Lost</span>
) : wasCancelled ? (
  <span className="text-white/30 text-xs">Cancelled</span>
) : (
  <span className="text-white/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right text-white/40 text-xs tabular-nums">
                          {dateStr}<br />{timeStr}
                        </td>
                        <td className="p-4 text-right">
                          {canClaim && (
                            <button
                              onClick={() => handleClaim(row.roundId)}
                              disabled={claiming === row.roundId.toString()}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all"
                              style={{
                                background: claiming === row.roundId.toString() ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0.18)",
                                border: "1px solid rgba(52,211,153,0.35)",
                                color: "#6ee7b7",
                                opacity: claiming === row.roundId.toString() ? 0.5 : 1,
                              }}
                            >
                              {claiming === row.roundId.toString() ? "Claiming..." : "Claim"}
                            </button>
                          )}
                          {alreadyClaimed && <span className="text-white/25 text-xs">Claimed</span>}
                          {!canClaim && !alreadyClaimed && <span className="text-white/20 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
              }
