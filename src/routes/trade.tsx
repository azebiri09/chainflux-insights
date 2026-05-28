import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import TradingChart from "@/components/TradingChart";
import { MARKET_UNITS, useMarket } from "@/lib/markets";
import type { Market } from "@/lib/positions";
import { closePosition, openPosition, pnl, usePositions } from "@/lib/positions";
import { connectWallet, useWallet, shortAddr } from "@/lib/wallet";

export const Route = createFileRoute("/trade")({
  component: TradePage,
  head: () => ({ meta: [{ title: "Trade — ChainFlux" }] }),
});

const MARKETS: Market[] = ["GAS", "AAVE_BORROWS", "TXS_PER_BLOCK"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h"] as const;
type Timeframe = typeof TIMEFRAMES[number];
const TIMEFRAME_TICKS: Record<Timeframe, number> = {
  "1m": 6,
  "5m": 30,
  "15m": 90,
  "1h": 360,
};

const MARKET_DISPLAY: Record<Market, string> = {
  GAS: "GAS",
  AAVE_BORROWS: "AAVE BORROWS",
  TXS_PER_BLOCK: "TXS PER BLOCK",
};

function TradePage() {
  const [market, setMarket] = useState<Market>("GAS");
  const [dir, setDir] = useState<"LONG" | "SHORT">("LONG");
  const [size, setSize] = useState<string>("0.01");
  const [leverage, setLeverage] = useState<2 | 5>(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [zoom, setZoom] = useState(1);

  const wallet = useWallet();
  const m = useMarket(market);
  const { open } = usePositions(wallet);

  const sizeNum = Number(size) || 0;

  // Liquidation price — 80% of margin lost
  const liquidationPrice = useMemo(() => {
    if (!m.current) return null;
    const moveToLiq = 0.8 / leverage;
    if (dir === "LONG") return m.current * (1 - moveToLiq);
    return m.current * (1 + moveToLiq);
  }, [m.current, dir, leverage]);

  const visibleData = useMemo(() => {
    const ticks = Math.floor(TIMEFRAME_TICKS[timeframe] / zoom);
    return m.history.slice(-Math.max(ticks, 4));
  }, [m.history, timeframe, zoom]);

  const tfChange = useMemo(() => {
    if (visibleData.length < 2) return 0;
    const first = visibleData[0];
    const last = visibleData[visibleData.length - 1];
    return first ? ((last - first) / first) * 100 : 0;
  }, [visibleData]);

  const onOpen = async () => {
    if (!wallet || sizeNum <= 0) return;
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      await openPosition(market, dir, sizeNum, leverage);
      setTxHash("Position opened successfully!");
    } catch (e: any) {
      setError(e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="pt-28 pb-20 mx-auto max-w-7xl px-4 sm:px-8">
        {!wallet && (
          <div className="mb-8 glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
            <p className="text-white/80 text-sm">Connect your wallet to open positions.</p>
            <button
              onClick={() => connectWallet()}
              className="px-5 py-2.5 rounded-full bg-white text-[oklch(0.12_0.03_260)] text-sm font-medium hover:bg-white/90"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 glass rounded-2xl p-4 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {txHash && (
          <div className="mb-6 glass rounded-2xl p-4 border border-emerald-500/30 text-emerald-300 text-sm">
            {txHash}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chart panel */}
          <div className="lg:col-span-2 glass rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="relative">

              {/* Market selector */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {MARKETS.map((mm) => (
                  <button
                    key={mm}
                    onClick={() => setMarket(mm)}
                    className={`px-4 py-2 rounded-full text-xs tracking-[0.2em] uppercase border transition-colors ${
                      market === mm
                        ? "bg-white/10 border-white/30 text-white"
                        : "border-white/10 text-white/60 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {MARKET_DISPLAY[mm]}
                  </button>
                ))}
              </div>

              {/* Price display */}
              <div className="flex items-baseline gap-4 flex-wrap">
                <div className="text-5xl sm:text-6xl text-white tabular-nums font-semibold tracking-tight">
                  {m.current.toFixed(4)}
                </div>
                <div className="text-xs text-white/40 tracking-widest uppercase">
                  {MARKET_UNITS[market]}
                </div>
                <div
                  className={`text-sm tabular-nums px-3 py-1 rounded-full border ${
                    tfChange >= 0
                      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/5"
                      : "text-red-300 border-red-500/30 bg-red-500/5"
                  }`}
                >
                  {tfChange >= 0 ? "+" : ""}
                  {tfChange.toFixed(2)}% {timeframe}
                </div>
              </div>

              {/* Chart controls */}
              <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 rounded text-xs tracking-wider uppercase transition-colors ${
                        timeframe === tf
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setZoom((z) => Math.min(z * 2, 8))}
                      className="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 text-lg transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoom((z) => Math.max(z / 2, 0.25))}
                      className="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 text-lg transition-colors"
                    >
                      −
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setChartType("line")}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        chartType === "line"
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Line
                    </button>
                    <button
                      onClick={() => setChartType("candle")}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        chartType === "candle"
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Candle
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="mt-4 rounded-xl overflow-hidden"
                style={{ touchAction: "none" }}
              >
                <TradingChart data={visibleData} type={chartType} height={300} />
              </div>
            </div>
          </div>

          {/* Position builder */}
          <div className="glass rounded-2xl p-6 sm:p-7">
            <div className="text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Position</div>

            {/* Long / Short */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setDir("LONG")}
                className={`relative overflow-hidden py-5 rounded-xl text-base font-semibold tracking-wide transition-all border ${
                  dir === "LONG"
                    ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200 shadow-[inset_0_1px_0_oklch(1_0_0/0.15),0_10px_30px_-10px_oklch(0.75_0.18_155/0.4)]"
                    : "border-white/10 text-white/60 hover:text-white hover:border-white/25"
                }`}
              >
                <span className="block text-[10px] tracking-[0.3em] opacity-70 mb-1">BUY</span>
                LONG
              </button>
              <button
                onClick={() => setDir("SHORT")}
                className={`relative overflow-hidden py-5 rounded-xl text-base font-semibold tracking-wide transition-all border ${
                  dir === "SHORT"
                    ? "bg-red-500/20 border-red-400/60 text-red-200 shadow-[inset_0_1px_0_oklch(1_0_0/0.15),0_10px_30px_-10px_oklch(0.70_0.20_25/0.4)]"
                    : "border-white/10 text-white/60 hover:text-white hover:border-white/25"
                }`}
              >
                <span className="block text-[10px] tracking-[0.3em] opacity-70 mb-1">SELL</span>
                SHORT
              </button>
            </div>

            {/* Leverage selector */}
            <label className="block mt-7 text-[10px] tracking-[0.3em] text-white/50 uppercase">
              Leverage
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {([2, 5] as const).map((lv) => (
                <button
                  key={lv}
                  onClick={() => setLeverage(lv)}
                  className={`py-3 rounded-xl text-sm font-semibold tracking-wide transition-all border ${
                    leverage === lv
                      ? "bg-white/10 border-white/30 text-white"
                      : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                  }`}
                >
                  {lv}×
                </button>
              ))}
            </div>

            {/* Collateral */}
            <label className="block mt-7 text-[10px] tracking-[0.3em] text-white/50 uppercase">
              Collateral (ETH)
            </label>
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              type="number"
              min="0.001"
              step="0.001"
              className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-lg tabular-nums focus:outline-none focus:border-white/30"
            />

            {/* Position details */}
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Market</span>
                <span className="text-white">{MARKET_DISPLAY[market]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Entry Price</span>
                <span className="text-white tabular-nums">{m.current.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Direction</span>
                <span className={dir === "LONG" ? "text-emerald-300" : "text-red-300"}>{dir}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Leverage</span>
                <span className="text-white">{leverage}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Liquidation Price</span>
                <span className="text-red-300 tabular-nums">
                  {liquidationPrice ? liquidationPrice.toFixed(4) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Fee (0.3%)</span>
                <span className="text-white tabular-nums">{(sizeNum * 0.003).toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Min collateral</span>
                <span className="text-white/50">0.001 ETH</span>
              </div>
            </div>

            <button
              disabled={!wallet || loading || sizeNum < 0.001}
              onClick={onOpen}
              className="mt-7 w-full py-4 rounded-xl bg-white text-[oklch(0.12_0.03_260)] text-sm font-semibold tracking-wide hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Confirming..." : wallet ? `Open ${dir} ${leverage}×` : "Connect Wallet"}
            </button>
            {wallet && (
              <p className="mt-4 text-[11px] text-white/40 font-mono text-center">
                {shortAddr(wallet)}
              </p>
            )}
          </div>
        </div>

        {/* Open positions */}
        <div className="mt-10 glass rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/5 text-white font-medium tracking-tight">
            Open Positions
          </div>
          <PositionsTable open={open} />
        </div>
      </div>
    </Layout>
  );
}

function PositionsTable({ open }: { open: ReturnType<typeof usePositions>["open"] }) {
  const [closing, setClosing] = useState<string | null>(null);
  const gas = useMarket("GAS");
  const aave = useMarket("AAVE_BORROWS");
  const txs = useMarket("TXS_PER_BLOCK");
  const price = (m: Market) =>
    m === "GAS" ? gas.current : m === "AAVE_BORROWS" ? aave.current : txs.current;

  const onClose = async (id: string, cur: number) => {
    setClosing(id);
    try {
      await closePosition(id, cur);
    } catch (e) {
      console.error(e);
    } finally {
      setClosing(null);
    }
  };

  if (!open.length) {
    return (
      <div className="p-8 text-sm text-white/50">
        No open positions yet. Head to the position builder to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-white/50 text-[10px] uppercase tracking-[0.25em]">
          <tr>
            <th className="text-left px-6 py-4">Market</th>
            <th className="text-left px-6 py-4">Direction</th>
            <th className="text-left px-6 py-4">Leverage</th>
            <th className="text-right px-6 py-4">Collateral</th>
            <th className="text-right px-6 py-4">Entry</th>
            <th className="text-right px-6 py-4">Liq. Price</th>
            <th className="text-right px-6 py-4">Current</th>
            <th className="text-right px-6 py-4">PnL</th>
            <th className="text-right px-6 py-4"></th>
          </tr>
        </thead>
        <tbody>
          {open.map((p) => {
            const cur = price(p.market);
            const v = pnl(p, cur);
            const moveToLiq = 0.8 / p.leverage;
            const liqPrice = p.direction === "LONG"
              ? p.entryPrice * (1 - moveToLiq)
              : p.entryPrice * (1 + moveToLiq);
            return (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-6 py-4 text-white">{MARKET_DISPLAY[p.market]}</td>
                <td className={`px-6 py-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>
                  {p.direction}
                </td>
                <td className="px-6 py-4 text-white/70">{p.leverage}×</td>
                <td className="px-6 py-4 text-right text-white tabular-nums">
                  {p.collateral.toFixed(4)} ETH
                </td>
                <td className="px-6 py-4 text-right text-white/80 tabular-nums">
                  {p.entryPrice.toFixed(4)}
                </td>
                <td className="px-6 py-4 text-right text-red-300 tabular-nums">
                  {liqPrice.toFixed(4)}
                </td>
                <td className="px-6 py-4 text-right text-white tabular-nums">{cur.toFixed(4)}</td>
                <td className={`px-6 py-4 text-right tabular-nums ${v >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {v.toFixed(4)} ETH
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onClose(p.id, cur)}
                    disabled={closing === p.id}
                    className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10 disabled:opacity-40"
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
  );
  }
