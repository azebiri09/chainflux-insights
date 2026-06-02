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

// ── Predict contract ──────────────────────────────────────────────────────────

const PREDICT_PROXY = "0x7708a4C85F526E23090d3B27201487E91AF58694";
const PREDICT_ABI = [
  "function stake(uint256 roundId, uint8 direction) payable",
  "function claim(uint256 roundId)",
  "function rounds(uint256 roundId) view returns (uint256 id, uint8 metric, uint8 timeframe, uint256 startValue, uint256 endValue, uint256 openTime, uint256 closeTime, uint256 higherPool, uint256 lowerPool, uint8 status, uint8 result)",
  "function getUserStake(uint256 roundId, address user) view returns (uint256 amount, uint8 direction, bool claimed)",
  "function getLatestRound(uint8 metric, uint8 timeframe) view returns (uint256)",
];

const STATUS_LABEL: Record<number, string> = { 0: "Open", 1: "Resolved", 2: "Cancelled" };
const RESULT_LABEL: Record<number, string> = { 0: "Higher", 1: "Lower" };

type PredictMetric = { contractId: number; label: string; timeframe: 0 | 1; tfLabel: string };

const PREDICT_SLOTS: PredictMetric[] = [
  { contractId: 0, label: "Active Addresses", timeframe: 0, tfLabel: "1H" },
  { contractId: 0, label: "Active Addresses", timeframe: 1, tfLabel: "24H" },
  { contractId: 2, label: "Gas Price", timeframe: 0, tfLabel: "1H" },
  { contractId: 2, label: "Gas Price", timeframe: 1, tfLabel: "24H" },
  { contractId: 3, label: "Txs Per Block", timeframe: 0, tfLabel: "1H" },
  { contractId: 3, label: "Txs Per Block", timeframe: 1, tfLabel: "24H" },
];

type PredictRow = {
  roundId: bigint;
  metric: PredictMetric;
  status: number;
  result: number;
  closeTime: bigint;
  higherPool: bigint;
  lowerPool: bigint;
  userAmount: bigint;
  userDirection: number;
  userClaimed: boolean;
};

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

function usePredictRows(wallet: string | null | undefined) {
  const [rows, setRows] = useState<PredictRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) { setRows([]); return; }
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
      const contract = new ethers.Contract(PREDICT_PROXY, PREDICT_ABI, provider);

      const results = await Promise.all(
        PREDICT_SLOTS.map(async (slot) => {
          try {
            const roundId: bigint = await contract.getLatestRound(slot.contractId, slot.timeframe);
            const raw = await contract.rounds(roundId);
            const us = await contract.getUserStake(roundId, wallet);
            const userAmount: bigint = us[0];
            if (userAmount === 0n) return null;
            return {
              roundId,
              metric: slot,
              status: Number(raw[9]),
              result: Number(raw[10]),
              closeTime: raw[6],
              higherPool: raw[7],
              lowerPool: raw[8],
              userAmount,
              userDirection: Number(us[1]),
              userClaimed: us[2],
            } as PredictRow;
          } catch { return null; }
        })
      );

      setRows(results.filter(Boolean) as PredictRow[]);
    } catch (e) {
      console.error("Predict rows error:", e);
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

// ── Portfolio page ────────────────────────────────────────────────────────────

function PortfolioPage() {
  const wallet = useWallet();
  const { open, hist } = usePositions(wallet);
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");
  const price = (m: Market) => m === "GAS" ? gas.current : txs.current;
  const { rows: predictRows, loading: predictLoading, reload: reloadPredict } = usePredictRows(wallet);

  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

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

        {/* ── Open perp positions ── */}
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

        {/* ── Predict positions ── */}
        <h2 className="mt-14 text-[10px] tracking-[0.3em] text-white/50 uppercase">Predict Positions</h2>
        <div className="mt-4 glass rounded-2xl overflow-hidden">
          {!wallet ? (
            <div className="p-6 text-sm text-white/60">Connect your wallet to see your predictions.</div>
          ) : predictLoading && predictRows.length === 0 ? (
            <div className="p-6 text-sm text-white/40">Loading predictions...</div>
          ) : predictRows.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              No predict positions yet. Head to <Link to="/predict" className="text-white underline-offset-4 hover:underline">Predict</Link> to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              {claimError && (
                <div className="px-5 py-3 text-xs text-red-400/80 border-b border-white/5">{claimError}</div>
              )}
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Metric</th>
                    <th className="text-left p-4">Timeframe</th>
                    <th className="text-left p-4">Your Call</th>
                    <th className="text-right p-4">Staked</th>
                    <th className="text-right p-4">Pool</th>
                    <th className="text-right p-4">Status</th>
                    <th className="text-right p-4">Result</th>
                    <th className="text-right p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {predictRows.map((row, i) => {
                    const key = row.roundId.toString();
                    const isOpen = row.status === 0;
                    const isResolved = row.status === 1;
                    const totalPool = row.higherPool + row.lowerPool;
                    const userWon = isResolved && row.userDirection === row.result;
                    const canClaim = isResolved && userWon && !row.userClaimed;
                    const alreadyClaimed = isResolved && row.userClaimed;
                    const lost = isResolved && !userWon;

                    return (
                      <tr key={`${key}-${i}`} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white font-medium">{row.metric.label}</td>
                        <td className="p-4">
                          <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                            {row.metric.tfLabel}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={row.userDirection === 0 ? "text-emerald-300" : "text-red-300"}>
                            {row.userDirection === 0 ? "Higher" : "Lower"}
                          </span>
                        </td>
                        <td className="p-4 text-right text-white tabular-nums">{formatEth(row.userAmount)} ETH</td>
                        <td className="p-4 text-right text-white/50 tabular-nums">{formatEth(totalPool)} ETH</td>
                        <td className="p-4 text-right">
                          {isOpen ? (
                            <span className="text-emerald-300/70 text-xs">{formatCountdown(row.closeTime)}</span>
                          ) : (
                            <span className="text-white/40 text-xs">{STATUS_LABEL[row.status]}</span>
                          )}
                        </td>
                        <td className="p-4 text-right text-xs">
                          {isResolved ? (
                            <span className={userWon ? "text-emerald-300" : "text-red-300/70"}>
                              {RESULT_LABEL[row.result]} {userWon ? "— Won" : "— Lost"}
                            </span>
                          ) : (
                            <span className="text-white/25">Pending</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {canClaim && (
                            <button
                              onClick={() => handleClaim(row.roundId)}
                              disabled={claiming === key}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                background: "rgba(52,211,153,0.15)",
                                border: "1px solid rgba(52,211,153,0.30)",
                                color: "#6ee7b7",
                                opacity: claiming === key ? 0.5 : 1,
                              }}
                            >
                              {claiming === key ? "Claiming..." : "Claim"}
                            </button>
                          )}
                          {alreadyClaimed && <span className="text-white/25 text-xs">Claimed</span>}
                          {lost && <span className="text-white/25 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Trade history ── */}
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
      </div>
    </Layout>
  );
   }
