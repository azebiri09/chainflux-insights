import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Lock } from "@phosphor-icons/react";
import Layout from "@/components/Layout";
import TradingChart from "@/components/TradingChart";
import { MARKET_UNITS, useMarket } from "@/lib/markets";
import type { Market } from "@/lib/positions";
import { closePosition, openPosition, pnl, usePositions, ethToCft } from "@/lib/positions";
import { connectWallet, useWallet, shortAddr } from "@/lib/wallet";
import { ethers } from "ethers";

export const Route = createFileRoute("/trade")({
  component: TradePage,
  head: () => ({ meta: [{ title: "Trade — ChainFlux" }] }),
});

const MARKETS: Market[] = ["GAS", "TXS_PER_BLOCK"];
const TIMEFRAMES = ["30s", "1m", "5m"] as const;
type Timeframe = typeof TIMEFRAMES[number];

const MARKET_DISPLAY: Record<Market, string> = {
  GAS: "GAS",
  TXS_PER_BLOCK: "TXS PER BLOCK",
};

const TIER_NAMES = ["Unranked", "Bronze", "Silver", "Gold", "Diamond"];
const TIER_COLORS = ["#ffffff40", "#cd7f32", "#c0c0c0", "#ffd700", "#a8d8f0"];
const TIER_LEVERAGE = [5, 10, 20, 25, 30];
const TIER_THRESHOLDS = [0, 5000, 50000, 200000, 500000];
const ALL_LEVERAGES = [2, 5, 10, 15, 20, 25, 30] as const;
type LeverageOption = typeof ALL_LEVERAGES[number];

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";
const CHAINFLUX_ABI = [
  "function getTierInfo(address user) view returns (uint8 tier, uint256 cftBalance, uint8 maxLeverage, uint256 nextTierThreshold)",
];

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

function TradePage() {
  const [market, setMarket] = useState<Market>("GAS");
  const [dir, setDir] = useState<"LONG" | "SHORT">("LONG");
  const [size, setSize] = useState<string>("0.01");
  const [leverage, setLeverage] = useState<LeverageOption>(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);

  const wallet = useWallet();
  const m = useMarket(market);
  const { open } = usePositions(wallet);

  const sizeNum = Number(size) || 0;

  useEffect(() => {
    if (!wallet) { setTierInfo(null); return; }
    fetchTierInfo(wallet).then(setTierInfo).catch(() => setTierInfo(null));
  }, [wallet]);

  // If selected leverage is now above tier max, clamp it down
  useEffect(() => {
    if (!tierInfo) return;
    if (leverage > tierInfo.maxLeverage) {
      const valid = ALL_LEVERAGES.filter(lv => lv <= tierInfo.maxLeverage);
      setLeverage(valid[valid.length - 1] ?? 2);
    }
  }, [tierInfo]);

  const cftPreview = useMemo(() => {
    if (!m.current || sizeNum <= 0) return 0;
    const fee = sizeNum * 0.003;
    const collateral = sizeNum - fee;
    return ethToCft(collateral, m.current);
  }, [sizeNum, m.current]);

  const liquidationPrice = useMemo(() => {
    if (!m.current) return null;
    const moveToLiq = 0.8 / leverage;
    if (dir === "LONG") return m.current * (1 - moveToLiq);
    return m.current * (1 + moveToLiq);
  }, [m.current, dir, leverage]);

  const tfChange = useMemo(() => {
    const history = m.history;
    if (history.length < 2) return 0;
    const first = history[0];
    const last = history[history.length - 1];
    return first ? ((last - first) / first) * 100 : 0;
  }, [m.history]);

  const onOpen = async () => {
    if (!wallet || sizeNum <= 0) return;
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      await openPosition(market, dir, sizeNum, leverage);
      setTxHash("Position opened successfully!");
      // Refresh tier info after trade
      fetchTierInfo(wallet).then(setTierInfo).catch(() => {});
    } catch (e: any) {
      setError(e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const maxLev = tierInfo?.maxLeverage ?? 5;
  const userTier = tierInfo?.tier ?? 0;

  // Which tier unlocks a given leverage option
  function tierRequiredForLeverage(lv: number): number {
    for (let t = TIER_LEVERAGE.length - 1; t >= 0; t--) {
      if (lv <= TIER_LEVERAGE[t]) return t;
    }
    return 0;
  }

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

                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setChartType("line")}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      chartType === "line" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType("candle")}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      chartType === "candle" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    Candle
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl overflow-hidden" style={{ touchAction: "none" }}>
                <TradingChart
                  data={m.history}
                  timeframe={timeframe}
                  type={chartType}
                  height={300}
                  entryPrice={open.find(p => p.market === market)?.entryPrice}
                  liquidationPrice={
                    open.find(p => p.market === market)
                      ? (() => {
                          const pos = open.find(p => p.market === market)!;
                          const moveToLiq = 0.8 / pos.leverage;
                          return pos.direction === "LONG"
                            ? pos.entryPrice * (1 - moveToLiq)
                            : pos.entryPrice * (1 + moveToLiq);
                        })()
                      : liquidationPrice ?? undefined
                  }
                  direction={open.find(p => p.market === market)?.direction ?? dir}
                />
              </div>
            </div>
          </div>

          {/* Position builder */}
          <div className="glass rounded-2xl p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[10px] tracking-[0.3em] text-white/50 uppercase">Open Position</div>
              {tierInfo && (
                <div
                  className="text-[10px] tracking-[0.2em] uppercase font-semibold px-2.5 py-1 rounded-full border"
                  style={{
                    color: TIER_COLORS[tierInfo.tier],
                    borderColor: TIER_COLORS[tierInfo.tier] + "50",
                    background: TIER_COLORS[tierInfo.tier] + "12",
                  }}
                >
                  {TIER_NAMES[tierInfo.tier]}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              Leverage
            </label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {ALL_LEVERAGES.map((lv) => {
                const locked = lv > maxLev;
                const tierNeeded = tierRequiredForLeverage(lv);
                const isSelected = leverage === lv;
                return (
                  <button
                    key={lv}
                    onClick={() => !locked && setLeverage(lv)}
                    disabled={locked}
                    title={locked ? `Requires ${TIER_NAMES[tierNeeded]}` : undefined}
                    className={`relative py-3 rounded-xl text-xs font-semibold tracking-wide transition-all border flex flex-col items-center justify-center gap-0.5 ${
                      locked
                        ? "border-white/5 text-white/20 cursor-not-allowed"
                        : isSelected
                        ? "bg-white/10 border-white/30 text-white"
                        : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {locked ? (
                      <>
                        <Lock size={10} weight="bold" className="opacity-40" />
                        <span className="opacity-30">{lv}×</span>
                        <span
                          className="text-[8px] tracking-wide leading-none mt-0.5"
                          style={{ color: TIER_COLORS[tierNeeded] + "90" }}
                        >
                          {TIER_NAMES[tierNeeded]}
                        </span>
                      </>
                    ) : (
                      <span>{lv}×</span>
                    )}
                  </button>
                );
              })}
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

            {cftPreview > 0 && (
              <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[11px] tracking-[0.2em] text-white/50 uppercase">You receive</span>
                <span className="text-white tabular-nums text-sm font-semibold">
                  {cftPreview.toFixed(4)} CFT
                </span>
              </div>
            )}

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
                <span className="text-white tabular-nums">{(sizeNum * 0.003).toFixed(6)} ETH</span>
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
  const txs = useMarket("TXS_PER_BLOCK");
  const price = (m: Market) => m === "GAS" ? gas.current : txs.current;

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
            <th className="text-right px-6 py-4">CFT</th>
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
            const liqPrice =
              p.direction === "LONG"
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
                  {p.cftMinted.toFixed(4)} CFT
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
