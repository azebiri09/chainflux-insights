import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import Candles from "@/components/Candles";
import { MARKET_UNITS, useMarket } from "@/lib/markets";
import type { Market } from "@/lib/positions";
import { closePosition, openPosition, pnl, usePositions } from "@/lib/positions";
import { connectWallet, useWallet, shortAddr } from "@/lib/wallet";

export const Route = createFileRoute("/trade")({
  component: TradePage,
  head: () => ({ meta: [{ title: "Trade — ChainFlux" }] }),
});

const MARKETS: Market[] = ["GAS", "ACTIVITY", "FLOW"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h"] as const;
type Timeframe = typeof TIMEFRAMES[number];

const TIMEFRAME_TICKS: Record<Timeframe, number> = {
  "1m": 6,
  "5m": 30,
  "15m": 90,
  "1h": 360,
};

function LineChart({ data, height = 300 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;

  const w = 800;
  const padY = 20;
  const padX = 10;
  const min = Math.min(...data) * 0.999;
  const max = Math.max(...data) * 1.001;
  const range = max - min || 1;
  const scaleY = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2);
  const scaleX = (i: number) => padX + (i / (data.length - 1)) * (w - padX * 2);

  const points = data.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(" ");
  const areaPoints = [
    `${scaleX(0)},${height}`,
    ...data.map((v, i) => `${scaleX(i)},${scaleY(v)}`),
    `${scaleX(data.length - 1)},${height}`,
  ].join(" ");

  const up = data[data.length - 1] >= data[0];
  const color = up ? "oklch(0.78 0.16 155)" : "oklch(0.70 0.20 25)";
  const areaColor = up ? "oklch(0.78 0.16 155 / 0.1)" : "oklch(0.70 0.20 25 / 0.1)";

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={padX} x2={w - padX}
          y1={padY + p * (height - padY * 2)}
          y2={padY + p * (height - padY * 2)}
          stroke="oklch(1 0 0 / 0.06)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#lineGrad)" />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Last price dot */}
      <circle
        cx={scaleX(data.length - 1)}
        cy={scaleY(data[data.length - 1])}
        r={4}
        fill={color}
        opacity={0.9}
      />

      {/* Last price line */}
      <line
        x1={padX} x2={w - padX}
        y1={scaleY(data[data.length - 1])}
        y2={scaleY(data[data.length - 1])}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="6 3"
        opacity={0.3}
      />
    </svg>
  );
}

function TradePage() {
  const [market, setMarket] = useState<Market>("GAS");
  const [dir, setDir] = useState<"LONG" | "SHORT">("LONG");
  const [size, setSize] = useState<string>("0.01");
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

  // Slice history based on timeframe and zoom
  const visibleData = useMemo(() => {
    const ticks = Math.floor(TIMEFRAME_TICKS[timeframe] / zoom);
    return m.history.slice(-Math.max(ticks, 4));
  }, [m.history, timeframe, zoom]);

  // % change for selected timeframe
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
      await openPosition(market, dir, sizeNum);
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
                    {mm}
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

                {/* Timeframe selector */}
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

                {/* Right side controls */}
                <div className="flex items-center gap-3">
                  {/* Zoom */}
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

                  {/* Chart type toggle */}
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

              {/* Chart */}
              <div className="mt-4">
                {chartType === "line"
                  ? <LineChart data={visibleData} height={300} />
                  : <Candles data={visibleData} height={300} />
                }
              </div>

            </div>
          </div>

          {/* Position builder */}
          <div className="glass rounded-2xl p-6 sm:p-7">
            <div className="text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Position</div>
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

            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Market</span>
                <span className="text-white">{market}</span>
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
              {loading ? "Confirming..." : wallet ? `Open ${dir}` : "Connect Wallet"}
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
  const act = useMarket("ACTIVITY");
  const fl = useMarket("FLOW");
  const price = (m: Market) =>
    m === "GAS" ? gas.current : m === "ACTIVITY" ? act.current : fl.current;

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
            <th className="text-right px-6 py-4">Collateral</th>
            <th className="text-right px-6 py-4">Entry</th>
            <th className="text-right px-6 py-4">Current</th>
            <th className="text-right px-6 py-4">PnL</th>
            <th className="text-right px-6 py-4"></th>
          </tr>
        </thead>
        <tbody>
          {open.map((p) => {
            const cur = price(p.market);
            const v = pnl(p, cur);
            return (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-6 py-4 text-white">{p.market}</td>
                <td className={`px-6 py-4 ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>
                  {p.direction}
                </td>
                <td className="px-6 py-4 text-right text-white tabular-nums">
                  {p.collateral.toFixed(4)} ETH
                </td>
                <td className="px-6 py-4 text-right text-white/80 tabular-nums">
                  {p.entryPrice.toFixed(4)}
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
