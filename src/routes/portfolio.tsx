import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { MARKET_LABELS, useMarket } from "@/lib/markets";
import { closePosition, pnl, usePositions } from "@/lib/positions";
import type { Market, Position } from "@/lib/positions";
import { useWallet, connectWallet } from "@/lib/wallet";
import { ethers } from "ethers";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({ meta: [{ title: "Portfolio — ChainFlux" }] }),
});

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";
const CHAINFLUX_ABI = [
  "function getTierInfo(address user) view returns (uint8 tier, uint256 cftBalance, uint8 maxLeverage, uint256 nextTierThreshold)",
];

const TIER_NAMES = ["Unranked", "Bronze", "Silver", "Gold", "Diamond"];
const TIER_COLORS = ["#ffffff40", "#cd7f32", "#c0c0c0", "#ffd700", "#a8d8f0"];
const TIER_THRESHOLDS = [0, 5000, 50000, 200000, 500000];
const TIER_LEVERAGE = [5, 10, 20, 25, 30];

interface TierInfo {
  tier: number;
  cftBalance: number;
  maxLeverage: number;
  nextTierThreshold: number;
}

async function fetchTierInfo(address: string): Promise<TierInfo> {
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const contract = new ethers.Contract(PROXY_ADDRESS, CHAINFLUX_ABI, provider);
  const result = await contract.getTierInfo(address);
  return {
    tier: Number(result[0]),
    cftBalance: Number(ethers.formatUnits(result[1], 18)),
    maxLeverage: Number(result[2]),
    nextTierThreshold: Number(ethers.formatUnits(result[3], 18)),
  };
}

function formatEth(val: number): string {
  if (!isFinite(val) || val === 0) return "0";
  if (val < 0.0001) return "<0.0001";
  return val.toFixed(4);
}

function TierCard({ tierInfo }: { tierInfo: TierInfo }) {
  const { tier, cftBalance, nextTierThreshold } = tierInfo;
  const color = TIER_COLORS[tier];
  const name = TIER_NAMES[tier];
  const isMax = tier === 4;

  const prevThreshold = TIER_THRESHOLDS[tier] ?? 0;
  const progress = isMax
    ? 100
    : nextTierThreshold > prevThreshold
    ? Math.min(100, ((cftBalance - prevThreshold) / (nextTierThreshold - prevThreshold)) * 100)
    : 100;

  const nextName = isMax ? null : TIER_NAMES[tier + 1];
  const nextLev = isMax ? null : TIER_LEVERAGE[tier + 1];

  return (
    <div
      className="glass rounded-2xl p-6 sm:p-8 mb-10 relative overflow-hidden"
      style={{ borderColor: color + "30" }}
    >
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          transform: "translate(30%, -30%)",
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-white/40 uppercase mb-2">Your Tier</div>
            <div className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color }}>
              {name}
            </div>
            <div className="mt-1 text-white/50 text-sm">Up to {tierInfo.maxLeverage}× leverage</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] text-white/40 uppercase mb-2">CFT Balance</div>
            <div className="text-2xl sm:text-3xl font-semibold text-white tabular-nums">
              {cftBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-white/40 text-xs mt-1">CFT</div>
          </div>
        </div>

        {!isMax && (
          <div className="mt-6">
            <div className="flex justify-between text-xs text-white/40 mb-2">
              <span>{name}</span>
              <span style={{ color: TIER_COLORS[tier + 1] }}>
                {nextName} — {nextLev}× max leverage
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${color}80, ${TIER_COLORS[tier + 1]})`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-white/30 mt-2">
              <span>{cftBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} CFT</span>
              <span>
                {(nextTierThreshold - cftBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} CFT to go
              </span>
            </div>
          </div>
        )}

        {isMax && (
          <div className="mt-4 text-xs text-white/30 tracking-wide">
            Maximum tier reached. All leverage levels unlocked.
          </div>
        )}
      </div>
    </div>
  );
}

// Live prices hook for portfolio
function useLivePrices() {
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");
  return { GAS: gas.current, TXS_PER_BLOCK: txs.current };
}

function PortfolioPage() {
  const wallet = useWallet();
  const { open: openPositions, hist } = usePositions(wallet);
  const livePrices = useLivePrices();
  const [closing, setClosing] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [tierLoading, setTierLoading] = useState(false);

  useEffect(() => {
    if (!wallet) { setTierInfo(null); return; }
    setTierLoading(true);
    fetchTierInfo(wallet)
      .then(setTierInfo)
      .catch(() => setTierInfo(null))
      .finally(() => setTierLoading(false));
  }, [wallet]);

  async function handleClose(id: string, market: Market) {
    setClosing(id);
    setCloseError(null);
    try {
      const currentPrice = livePrices[market] ?? 0;
      await closePosition(id, currentPrice);
      if (wallet) fetchTierInfo(wallet).then(setTierInfo).catch(() => {});
    } catch (err: any) {
      setCloseError(err?.message?.slice(0, 120) ?? "Close failed");
    } finally {
      setClosing(null);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 sm:px-10 py-28">
        <h1 className="text-3xl font-bold text-white tracking-tight">Portfolio</h1>
        <p className="mt-1 text-sm text-white/40">Your tier, open positions and trade history.</p>

        {!wallet && (
          <div className="mt-10 glass rounded-2xl p-8 flex flex-col items-center gap-4">
            <p className="text-white/60 text-sm">Connect your wallet to see your portfolio.</p>
            <button
              onClick={() => connectWallet()}
              className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {wallet && (
          <>
            <div className="mt-10">
              {tierLoading && (
                <div className="glass rounded-2xl p-8 mb-10 text-white/30 text-sm">
                  Loading tier data...
                </div>
              )}
              {!tierLoading && tierInfo && <TierCard tierInfo={tierInfo} />}
            </div>

            {/* Open Positions */}
            <h2 className="text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Positions</h2>
            <div className="mt-4 glass rounded-2xl overflow-hidden">
              {openPositions.length === 0 ? (
                <div className="p-6 text-sm text-white/60">No open positions.</div>
              ) : (
                <div className="overflow-x-auto">
                  {closeError && (
                    <div className="px-5 py-3 text-xs text-red-400/80 border-b border-white/5">{closeError}</div>
                  )}
                  <table className="w-full text-sm">
                    <thead className="text-white/50 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="text-left p-4">Market</th>
                        <th className="text-left p-4">Direction</th>
                        <th className="text-left p-4">Leverage</th>
                        <th className="text-right p-4">Collateral</th>
                        <th className="text-right p-4">Entry</th>
                        <th className="text-right p-4">Current</th>
                        <th className="text-right p-4">PnL</th>
                        <th className="text-right p-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {openPositions.map((p, i) => {
                        const currentPrice = livePrices[p.market] ?? p.entryPrice;
                        const v = pnl(p, currentPrice);
                        return (
                          <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                            <td className="p-4 text-white font-medium">{MARKET_LABELS[p.market] ?? p.market}</td>
                            <td className={`p-4 font-medium ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>
                              {p.direction}
                            </td>
                            <td className="p-4 text-white/70">{p.leverage}×</td>
                            <td className="p-4 text-right text-white tabular-nums">{formatEth(p.collateral)} ETH</td>
                            <td className="p-4 text-right text-white/80 tabular-nums">{p.entryPrice.toFixed(4)}</td>
                            <td className="p-4 text-right text-white/80 tabular-nums">
                              {currentPrice > 0 ? currentPrice.toFixed(4) : "—"}
                            </td>
                            <td className={`p-4 text-right tabular-nums font-medium ${v >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                              {isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(4)} ETH` : "—"}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleClose(p.id, p.market)}
                                disabled={closing === p.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                style={{
                                  background: closing === p.id ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  color: closing === p.id ? "rgba(255,255,255,0.3)" : "white",
                                }}
                              >
                                {closing === p.id ? "Closing..." : "Close"}
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

            {/* Trade History */}
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
                      {hist.map((p: Position, i: number) => {
                        const closePrice = typeof p.closePrice === "number" && isFinite(p.closePrice)
                          ? p.closePrice
                          : p.entryPrice;
                        const v = pnl(p, closePrice);
                        return (
                          <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                            <td className="p-4 text-white">
                              <div>{MARKET_LABELS[p.market] ?? p.market}</div>
                              {p.liquidated && (
                                <div className="text-[10px] tracking-widest uppercase text-red-400/80 mt-0.5">
                                  Liquidated
                                </div>
                              )}
                            </td>
                            <td className={`p-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>
                              {p.direction}
                            </td>
                            <td className="p-4 text-white/70">{p.leverage}×</td>
                            <td className="p-4 text-right text-white tabular-nums">{formatEth(p.collateral)} ETH</td>
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
          </>
        )}
      </div>
    </Layout>
  );
  }
