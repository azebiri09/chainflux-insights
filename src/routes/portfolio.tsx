import { createFileRoute, Link } from "@tanstack/react-router";
import Layout from "@/components/Layout";
import { useMarket } from "@/lib/markets";
import { closePosition, pnl, usePositions } from "@/lib/positions";
import type { Market } from "@/lib/positions";
import { useWallet, connectWallet, shortAddr } from "@/lib/wallet";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({ meta: [{ title: "Portfolio — ChainFlux" }] }),
});

function PortfolioPage() {
  const wallet = useWallet();
  const { open, hist } = usePositions();
  const gas = useMarket("GAS");
  const act = useMarket("ACTIVITY");
  const fl = useMarket("FLOW");
  const price = (m: Market) => (m === "GAS" ? gas.current : m === "ACTIVITY" ? act.current : fl.current);

  return (
    <Layout>
      <div className="pt-32 pb-20 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.3em] text-primary/80 uppercase">Portfolio</div>
            <h1 className="mt-5 text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.05]">Your positions.</h1>
          </div>
          {wallet ? (
            <span className="text-sm text-white/60 font-mono glass rounded-full px-4 py-2">{shortAddr(wallet)}</span>
          ) : (
            <button onClick={() => connectWallet()} className="px-5 py-2.5 rounded-full bg-white text-[oklch(0.12_0.03_260)] text-sm font-medium hover:bg-white/90">
              Connect Wallet
            </button>
          )}
        </div>

        {/* Open positions */}
        <h2 className="mt-14 text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Positions</h2>
        <div className="mt-4 glass rounded-2xl overflow-hidden">
          {open.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              No open positions yet. Head to <Link to="/trade" className="text-primary underline-offset-4 hover:underline">Trade</Link> to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Market</th>
                    <th className="text-left p-4">Direction</th>
                    <th className="text-right p-4">Size</th>
                    <th className="text-right p-4">Entry</th>
                    <th className="text-right p-4">Current</th>
                    <th className="text-right p-4">PnL</th>
                    <th className="text-right p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((p, i) => {
                    const cur = price(p.market);
                    const v = pnl(p, cur);
                    return (
                      <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white">{p.market}</td>
                        <td className={`p-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>{p.direction}</td>
                        <td className="p-4 text-right text-white tabular-nums">{p.size}</td>
                        <td className="p-4 text-right text-white/80 tabular-nums">{p.entry.toFixed(2)}</td>
                        <td className="p-4 text-right text-white tabular-nums">{cur.toFixed(2)}</td>
                        <td className={`p-4 text-right tabular-nums ${v >= 0 ? "text-emerald-300" : "text-red-300"}`}>{v.toFixed(2)}</td>
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

        {/* History */}
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
                    <th className="text-right p-4">Size</th>
                    <th className="text-right p-4">Entry</th>
                    <th className="text-right p-4">Close</th>
                    <th className="text-right p-4">PnL</th>
                    <th className="text-right p-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map((p, i) => {
                    const v = pnl(p, p.close ?? p.entry);
                    return (
                      <tr key={p.id} className={i % 2 ? "bg-white/[0.02]" : ""}>
                        <td className="p-4 text-white">{p.market}</td>
                        <td className={`p-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>{p.direction}</td>
                        <td className="p-4 text-right text-white tabular-nums">{p.size}</td>
                        <td className="p-4 text-right text-white/80 tabular-nums">{p.entry.toFixed(2)}</td>
                        <td className="p-4 text-right text-white/80 tabular-nums">{(p.close ?? 0).toFixed(2)}</td>
                        <td className={`p-4 text-right tabular-nums ${v >= 0 ? "text-emerald-300" : "text-red-300"}`}>{v.toFixed(2)}</td>
                        <td className="p-4 text-right text-white/60">{p.closedAt ? new Date(p.closedAt).toLocaleString() : ""}</td>
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
