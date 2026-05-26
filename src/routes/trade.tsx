import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Layout from "@/components/Layout";
import Sparkline from "@/components/Sparkline";
import { MARKET_UNITS, useMarket } from "@/lib/markets";
import type { Market } from "@/lib/positions";
import { closePosition, openPosition, pnl, usePositions } from "@/lib/positions";
import { connectWallet, useWallet, shortAddr } from "@/lib/wallet";

export const Route = createFileRoute("/trade")({
  component: TradePage,
  head: () => ({ meta: [{ title: "Trade — ChainFlux" }] }),
});

const MARKETS: Market[] = ["GAS", "ACTIVITY", "FLOW"];

function TradePage() {
  const [market, setMarket] = useState<Market>("GAS");
  const [dir, setDir] = useState<"LONG" | "SHORT">("LONG");
  const [size, setSize] = useState<string>("1");
  const wallet = useWallet();
  const m = useMarket(market);
  const { open } = usePositions();

  const sizeNum = Number(size) || 0;
  const estPnl = dir === "LONG" ? sizeNum * (m.current - m.current) : 0;

  const onOpen = () => {
    if (!wallet || sizeNum <= 0) return;
    openPosition({ market, direction: dir, size: sizeNum, entry: m.current });
  };

  return (
    <Layout>
      <div className="pt-20 pb-12 mx-auto max-w-7xl px-4 sm:px-6">
        {!wallet && (
          <div className="mb-6 rounded-lg border border-white/10 bg-card p-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-white/80 text-sm">Connect your wallet to open positions.</p>
            <button onClick={() => connectWallet()} className="px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary/90">
              Connect Wallet
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Chart panel */}
          <div className="lg:col-span-2 rounded-xl bg-card border border-white/5 p-5">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {MARKETS.map((mm) => (
                <button
                  key={mm}
                  onClick={() => setMarket(mm)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    market === mm ? "bg-primary/20 border-primary/50 text-white" : "border-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  {mm}
                </button>
              ))}
            </div>
            <div className="flex items-baseline gap-4">
              <div className="text-3xl sm:text-4xl text-white tabular-nums font-semibold">{m.current.toFixed(2)}</div>
              <div className="text-sm text-white/50">{MARKET_UNITS[market]}</div>
              <div className={`text-sm tabular-nums ${m.change >= 0 ? "text-emerald-400/90" : "text-red-400/90"}`}>
                {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}% 24h
              </div>
            </div>
            <div className="mt-4 text-primary/80">
              <Sparkline data={m.history} height={220} stroke="oklch(0.75 0.10 245)" />
            </div>
          </div>

          {/* Position builder */}
          <div className="rounded-xl bg-card border border-white/5 p-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDir("LONG")}
                className={`py-2.5 rounded-md text-sm font-medium border ${dir === "LONG" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "border-white/10 text-white/70"}`}
              >
                LONG
              </button>
              <button
                onClick={() => setDir("SHORT")}
                className={`py-2.5 rounded-md text-sm font-medium border ${dir === "SHORT" ? "bg-red-500/15 border-red-500/40 text-red-300" : "border-white/10 text-white/70"}`}
              >
                SHORT
              </button>
            </div>
            <label className="block mt-5 text-xs text-white/50">Size</label>
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              type="number"
              min="0"
              step="0.1"
              className="mt-1 w-full bg-background border border-white/10 rounded-md px-3 py-2 text-white tabular-nums focus:outline-none focus:border-primary/50"
            />
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-white/50">Entry Price</span>
              <span className="text-white tabular-nums">{m.current.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-white/50">Estimated PnL</span>
              <span className="text-white tabular-nums">{estPnl.toFixed(2)}</span>
            </div>
            <button
              disabled={!wallet}
              onClick={onOpen}
              className="mt-5 w-full py-2.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wallet ? "Open Position" : "Connect Wallet"}
            </button>
            {wallet && <p className="mt-3 text-xs text-white/40 font-mono">Wallet: {shortAddr(wallet)}</p>}
          </div>
        </div>

        {/* Open positions */}
        <div className="mt-6 rounded-xl bg-card border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 text-white font-medium">Open Positions</div>
          <PositionsTable open={open} />
        </div>
      </div>
    </Layout>
  );
}

function PositionsTable({ open }: { open: ReturnType<typeof usePositions>["open"] }) {
  const gas = useMarket("GAS");
  const act = useMarket("ACTIVITY");
  const fl = useMarket("FLOW");
  const price = (m: Market) => (m === "GAS" ? gas.current : m === "ACTIVITY" ? act.current : fl.current);

  if (!open.length) {
    return <div className="p-6 text-sm text-white/50">No open positions.</div>;
  }
  return (
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
  );
}
