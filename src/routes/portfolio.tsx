import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { MARKET_LABELS } from "@/lib/markets";
import { closePosition, pnl, usePositions } from "@/lib/positions";
import type { Market } from "@/lib/positions";
import { useWallet, connectWallet, shortAddr } from "@/lib/wallet";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({ meta: [{ title: "Portfolio — ChainFlux" }] }),
});

function formatEth(val: number): string {
  if (!isFinite(val) || val === 0) return "0";
  if (val < 0.0001) return "<0.0001";
  return val.toFixed(4);
}

function PortfolioPage() {
  const wallet = useWallet();
  const { open: openPositions, history: hist, loading, refresh } = usePositions();
  const [closing, setClosing] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  async function handleClose(id: string, market: Market) {
    setClosing(id);
    setCloseError(null);
    try {
      await closePosition(id, market);
      await refresh();
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
        <p className="mt-1 text-sm text-white/40">Your open positions and trade history.</p>

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
            {/* Open Positions */}
            <h2 className="mt-12 text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Positions</h2>
            <div className="mt-4 glass rounded-2xl overflow-hidden">
              {loading ? (
                <div className="p-6 text-sm text-white/40">Loading...</div>
              ) : openPositions.length === 0 ? (
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
                        const v = pnl(p, p.currentPrice ?? p.entryPrice);
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
                              {(p.currentPrice ?? p.entryPrice).toFixed(4)}
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
                      {hist.map((p, i) => {
                        const closePrice = typeof p.closePrice === "number" && isFinite(p.closePrice)
                          ? p.closePrice
                          : p.entryPrice;
                        const v = pnl(p, closePrice);
                        return (
                          <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                            <td className="p-4 text-white">{MARKET_LABELS[p.market] ?? p.market}</td>
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
