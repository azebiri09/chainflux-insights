import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Lock } from "@phosphor-icons/react";
import Layout from "@/components/Layout";
import TradingChart from "@/components/TradingChart";
import { MARKET_UNITS, useMarket, useNetworkFeed } from "@/lib/markets";
import type { Market } from "@/lib/positions";
import { closePosition, openPosition, pnl, usePositions, checkLiquidations } from "@/lib/positions";
import { connectWallet, useWallet, shortAddr } from "@/lib/wallet";
import { ethers } from "ethers";

export const Route = createFileRoute("/trade")({
  component: TradePage,
  head: () => ({ meta: [{ title: "Trade ChainFlux" }] }),
});

const MARKETS: Market[] = ["GAS", "TXS_PER_BLOCK"];
const TIMEFRAMES = ["30s", "1m", "5m"] as const;
type Timeframe = typeof TIMEFRAMES[number];

const MARKET_DISPLAY: Record<Market, string> = {
  GAS: "GAS",
  TXS_PER_BLOCK: "TXS PER BLOCK",
};

const TIER_NAMES = ["Unranked", "Bronze", "Silver", "Gold", "Diamond"];
const TIER_COLORS = ["rgba(255,255,255,0.40)", "#cd7f32", "#c0c0c0", "#ffd700", "#a8d8f0"];
const TIER_LEVERAGE = [5, 10, 20, 25, 30];
const ALL_LEVERAGES = [2, 5, 10, 15, 20, 25, 30] as const;
type LeverageOption = typeof ALL_LEVERAGES[number];

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";
const DEPLOY_BLOCK = 0;

const CHAINFLUX_ABI = [
  "function getTierInfo(address user) view returns (uint8 tier, uint256 cftBalance, uint8 maxLeverage, uint256 nextTierThreshold)",
  "event PositionClosed(uint256 indexed id, address indexed trader, int256 pnl, uint256 payout, uint256 cftRewarded)",
];

const CFT_MIN_HOLD = 1200;

interface TierInfo {
  tier: number;
  cftBalance: number;
  maxLeverage: number;
  nextTierThreshold: number;
}

interface ClosedTrade {
  id: string;
  pnl: number;
  payout: number;
  cftRewarded: number;
  blockNumber: number;
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

async function fetchClosedTradesForWallet(wallet: string): Promise<ClosedTrade[]> {
  const provider = new ethers.JsonRpcProvider("https://arb-sepolia.g.alchemy.com/v2/6d-NCac8fCgKkqyBEC12f");
  const contract = new ethers.Contract(PROXY_ADDRESS, CHAINFLUX_ABI, provider);
  const latestBlock = await provider.getBlockNumber();
  const CHUNK = 50000;
  const allEvents: ethers.EventLog[] = [];

  for (let from = DEPLOY_BLOCK; from <= latestBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latestBlock);
    try {
      const chunk = await contract.queryFilter(
        contract.filters.PositionClosed(null, wallet),
        from,
        to
      );
      for (const e of chunk) {
        if ("args" in e) allEvents.push(e as ethers.EventLog);
      }
    } catch {
      // skip failed chunk
    }
  }

  return allEvents.map((e) => ({
    id: e.args.id.toString(),
    pnl: Number(ethers.formatUnits(e.args.pnl as bigint, 18)),
    payout: Number(ethers.formatUnits(e.args.payout as bigint, 18)),
    cftRewarded: Number(ethers.formatUnits(e.args.cftRewarded as bigint, 18)),
    blockNumber: e.blockNumber,
  })).reverse();
}

function tierRequiredForLeverage(lv: number): number {
  for (let t = 0; t < TIER_LEVERAGE.length; t++) {
    if (lv <= TIER_LEVERAGE[t]) return t;
  }
  return TIER_LEVERAGE.length - 1;
}

function toSeconds(openedAt: number): number {
  return openedAt > 1e12 ? Math.floor(openedAt / 1000) : openedAt;
}

function useCFTCountdown(openedAt: number) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    const update = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsed = nowSec - toSeconds(openedAt);
      setSecondsLeft(Math.max(0, CFT_MIN_HOLD - elapsed));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [openedAt]);
  return secondsLeft;
}

function CFTCountdown({ openedAt }: { openedAt: number }) {
  const secondsLeft = useCFTCountdown(openedAt);
  if (secondsLeft === 0) return <span className="text-emerald-400 text-xs font-medium">CFT ready</span>;
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return (
    <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.50)" }}>
      CFT in {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}

function estimateCFT(collateralEth: number, leverage: number): number {
  if (!collateralEth || collateralEth <= 0) return 0;
  const fee = collateralEth * 0.003;
  const collateral = collateralEth - fee;
  return collateral * leverage * 1000;
}

function computeAttentionScore(
  gas: number, gasHigh: number, gasLow: number,
  txs: number, txsHigh: number, txsLow: number,
  addr: number, addrHigh: number, addrLow: number
): number {
  const norm = (v: number, lo: number, hi: number) => {
    const range = hi - lo;
    if (range <= 0) return 50;
    return Math.min(100, Math.max(0, ((v - lo) / range) * 100));
  };
  return Math.round(
    norm(gas, gasLow, gasHigh) * 0.4 +
    norm(txs, txsLow, txsHigh) * 0.4 +
    norm(addr, addrLow, addrHigh) * 0.2
  );
}

function AttentionPrompt({ score }: { score: number }) {
  if (score < 70) return null;
  const critical = score >= 86;
  const text = critical
    ? "Ethereum activity is approaching recent highs. Market attention is concentrated on network demand."
    : "Network demand is accelerating. Activity is rising across Ethereum and traders are positioning for increased usage.";
  const color = critical ? "rgba(239,68,68,0.90)" : "rgba(249,115,22,0.90)";
  const borderColor = critical ? "rgba(239,68,68,0.20)" : "rgba(249,115,22,0.20)";
  return (
    <div
      className="mb-6 px-5 py-3.5 rounded-xl flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${borderColor}` }}
    >
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <p className="text-sm leading-relaxed" style={{ color }}>{text}</p>
    </div>
  );
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
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const wallet = useWallet();
  const m = useMarket(market);
  const { open } = usePositions(wallet);
  const gas = useMarket("GAS");
  const txs = useMarket("TXS_PER_BLOCK");
  const feed = useNetworkFeed();

  useEffect(() => {
    if (gas.current > 0 || txs.current > 0) {
      checkLiquidations({ GAS: gas.current, TXS_PER_BLOCK: txs.current });
    }
  }, [gas.current, txs.current]);

  const attentionScore = computeAttentionScore(
    gas.current, feed.GAS_DAILY_HIGH ?? 0, feed.GAS_DAILY_LOW ?? 0,
    txs.current, feed.TXS_DAILY_HIGH ?? 0, feed.TXS_DAILY_LOW ?? 0,
    feed.ACTIVE_ADDRESSES ?? 0, feed.ACTIVE_DAILY_HIGH ?? 0, feed.ACTIVE_DAILY_LOW ?? 0,
  );

  const sizeNum = Number(size) || 0;

  useEffect(() => {
    if (!wallet) { setTierInfo(null); setClosedTrades([]); return; }
    fetchTierInfo(wallet).then(setTierInfo).catch(() => setTierInfo(null));
    setHistoryLoading(true);
    fetchClosedTradesForWallet(wallet)
      .then(setClosedTrades)
      .catch(() => setClosedTrades([]))
      .finally(() => setHistoryLoading(false));
  }, [wallet]);

  useEffect(() => {
    if (!tierInfo) return;
    if (leverage > tierInfo.maxLeverage) {
      const valid = ALL_LEVERAGES.filter(lv => lv <= tierInfo.maxLeverage);
      setLeverage(valid[valid.length - 1] ?? 2);
    }
  }, [tierInfo]);

  const cftPreview = useMemo(() => {
    if (!m.current || sizeNum <= 0) return 0;
    return estimateCFT(sizeNum, leverage);
  }, [sizeNum, leverage, m.current]);

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
      fetchTierInfo(wallet).then(setTierInfo).catch(() => {});
    } catch (e: any) {
      const msg =
        e?.code === "ACTION_REJECTED"
          ? "Transaction rejected."
          : e?.reason || e?.shortMessage || "Transaction failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const maxLev = tierInfo?.maxLeverage ?? 5;

  return (
    <Layout>
      <div className="pt-28 pb-24 mx-auto max-w-7xl px-4 sm:px-8">

        {!wallet && (
          <div
            className="mb-8 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.18)" }}
          >
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>Connect your wallet to open positions.</p>
            <button
              onClick={() => connectWallet()}
              className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          <div className="flex flex-col gap-6">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.18)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            >
              <div className="px-6 py-5 flex flex-wrap items-center gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                <div className="flex gap-2">
                  {MARKETS.map((mk) => (
                    <button
                      key={mk}
                      onClick={() => setMarket(mk)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold tracking-widest transition-all border ${
                        market === mk
                          ? "bg-white/10 border-white/30 text-white"
                          : "border-white/10 hover:text-white/70 hover:border-white/20"
                      }`}
                      style={{ color: market === mk ? "#fff" : "rgba(255,255,255,0.40)" }}
                    >
                      {MARKET_DISPLAY[mk]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 ml-auto">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        timeframe === tf
                          ? "bg-white/10 border-white/25 text-white"
                          : "border-white/8 hover:text-white/60"
                      }`}
                      style={{ color: timeframe === tf ? "#fff" : "rgba(255,255,255,0.40)" }}
                    >
                      {tf}
                    </button>
                  ))}
                  <button
                    onClick={() => setChartType(chartType === "line" ? "candle" : "line")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 hover:text-white/60 transition-all ml-1"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                  >
                    {chartType === "line" ? "Candle" : "Line"}
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 flex flex-wrap items-baseline gap-x-4 gap-y-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {m.current > 0 ? m.current.toFixed(4) : "—"}
                </span>
                <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>{MARKET_UNITS[market]}</span>
                {m.history.length > 1 && (
                  <span className={`text-sm font-medium tabular-nums ${tfChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {tfChange >= 0 ? "+" : ""}{tfChange.toFixed(2)}%
                  </span>
                )}
              </div>

              <TradingChart data={m.history} type={chartType} timeframe={timeframe} />
            </div>
          </div>

          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "2px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="text-xs tracking-[0.3em] uppercase font-semibold mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>Trade</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-6">
              {MARKET_DISPLAY[market]}
            </h2>

            <AttentionPrompt score={attentionScore} />

            {tierInfo && (
              <div
                className="mb-6 flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wide" style={{ color: TIER_COLORS[tierInfo.tier] }}>
                    {TIER_NAMES[tierInfo.tier]}
                  </span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
                  <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.60)" }}>
                    {tierInfo.cftBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} CFT
                  </span>
                </div>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Max {tierInfo.maxLeverage}×</span>
              </div>
            )}

            {(error || txHash) && (
              <div className={`mb-5 px-4 py-3 rounded-xl text-xs border ${
                error
                  ? "bg-red-500/8 border-red-500/20 text-red-300"
                  : "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
              }`}>
                {error || txHash}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDir("LONG")}
                className={`py-4 rounded-xl text-sm font-bold tracking-wider transition-all border flex flex-col items-center gap-0.5 ${
                  dir === "LONG"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "border-white/10 hover:border-white/20"
                }`}
                style={{ color: dir === "LONG" ? undefined : "rgba(255,255,255,0.35)" }}
              >
                <span className="block text-[10px] tracking-[0.3em] opacity-60 mb-1">BUY</span>
                LONG
              </button>
              <button
                onClick={() => setDir("SHORT")}
                className={`py-4 rounded-xl text-sm font-bold tracking-wider transition-all border flex flex-col items-center gap-0.5 ${
                  dir === "SHORT"
                    ? "bg-red-500/15 border-red-500/40 text-red-300"
                    : "border-white/10 hover:border-white/20"
                }`}
                style={{ color: dir === "SHORT" ? undefined : "rgba(255,255,255,0.35)" }}
              >
                <span className="block text-[10px] tracking-[0.3em] opacity-60 mb-1">SELL</span>
                SHORT
              </button>
            </div>

            <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              <div className="text-xs tracking-[0.25em] uppercase font-medium mb-3" style={{ color: "rgba(255,255,255,0.60)" }}>Leverage</div>
              <div className="grid grid-cols-4 gap-2">
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
                      className={`relative py-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all border flex flex-col items-center justify-center gap-0.5 ${
                        locked
                          ? "border-white/5 cursor-not-allowed"
                          : isSelected
                          ? "bg-white/10 border-white/30 text-white"
                          : "border-white/10 hover:text-white hover:border-white/20"
                      }`}
                      style={{ color: locked ? "rgba(255,255,255,0.20)" : isSelected ? "#fff" : "rgba(255,255,255,0.50)" }}
                    >
                      {locked ? (
                        <>
                          <Lock size={12} weight="bold" className="opacity-50" />
                          <span className="opacity-40 text-sm font-semibold">{lv}×</span>
                          <span className="text-[11px] tracking-wide leading-none mt-1 font-semibold" style={{ color: TIER_COLORS[tierNeeded] }}>
                            {TIER_NAMES[tierNeeded]}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold">{lv}×</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              <label className="block text-xs tracking-[0.25em] uppercase font-medium mb-3" style={{ color: "rgba(255,255,255,0.60)" }}>
                Collateral (ETH)
              </label>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                type="number"
                min="0.001"
                step="0.001"
                className="w-full rounded-xl px-4 py-4 text-white text-lg tabular-nums focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              {cftPreview > 0 && (
                <div
                  className="mt-3 flex items-center justify-between px-4 py-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <span className="text-xs tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>You receive</span>
                  <span className="text-white tabular-nums text-sm font-semibold">
                    ~{cftPreview.toLocaleString(undefined, { maximumFractionDigits: 0 })} CFT
                  </span>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              {[
                { label: "Market", value: MARKET_DISPLAY[market], color: "rgba(255,255,255,0.90)" },
                { label: "Entry Price", value: m.current.toFixed(4), color: "rgba(255,255,255,0.90)" },
                { label: "Direction", value: dir, color: dir === "LONG" ? "#6ee7b7" : "#fca5a5" },
                { label: "Leverage", value: `${leverage}×`, color: "rgba(255,255,255,0.90)" },
                { label: "Liquidation Price", value: liquidationPrice ? liquidationPrice.toFixed(4) : "—", color: "#fca5a5" },
                { label: "Fee (0.3%)", value: `${(sizeNum * 0.003).toFixed(6)} ETH`, color: "rgba(255,255,255,0.90)" },
                { label: "Min collateral", value: "0.001 ETH", color: "rgba(255,255,255,0.55)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
                  <span className="text-sm tabular-nums" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>

            <button
              disabled={!wallet || loading || sizeNum < 0.001}
              onClick={onOpen}
              className="mt-8 w-full py-4 rounded-xl bg-white text-black text-sm font-semibold tracking-wide hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Confirming..." : wallet ? `Open ${dir} ${leverage}×` : "Connect Wallet"}
            </button>
            {wallet && (
              <p className="mt-4 text-xs text-center font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                {shortAddr(wallet)}
              </p>
            )}
          </div>
        </div>

        <div
          className="mt-12 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.18)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        >
          <div className="px-7 py-6 font-medium text-white tracking-tight" style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
            Open Positions
          </div>
          <PositionsTable open={open} />
        </div>

        <div
          className="mt-6 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.18)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        >
          <div className="px-7 py-6 font-medium text-white tracking-tight" style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
            Trade History
          </div>
          {!wallet ? (
            <div className="p-8 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              Connect your wallet to see your trade history.
            </div>
          ) : historyLoading ? (
            <div className="p-8 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              Loading your trade history...
            </div>
          ) : closedTrades.length === 0 ? (
            <div className="p-8 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              No closed trades yet for this wallet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Position ID", "PnL", "Payout", "CFT Earned", "Block"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-4 text-[10px] uppercase tracking-[0.25em] font-semibold ${i === 0 ? "text-left" : "text-right"}`}
                        style={{ color: "rgba(255,255,255,0.50)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td className="px-6 py-5 text-white font-mono text-xs">#{t.id}</td>
                      <td className={`px-6 py-5 text-right tabular-nums font-semibold ${t.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(4)} ETH
                      </td>
                      <td className="px-6 py-5 text-right tabular-nums text-white">
                        {t.payout.toFixed(4)} ETH
                      </td>
                      <td className="px-6 py-5 text-right tabular-nums" style={{ color: "rgba(255,255,255,0.70)" }}>
                        {t.cftRewarded > 0
                          ? `+${t.cftRewarded.toLocaleString(undefined, { maximumFractionDigits: 0 })} CFT`
                          : "—"}
                      </td>
                      <td className="px-6 py-5 text-right tabular-nums font-mono text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {t.blockNumber.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
      <div className="p-10 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
        No open positions yet. Head to the position builder to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Market", "Direction", "Leverage", "CFT", "Entry", "Liq. Price", "Current", "PnL", ""].map((h, i) => (
              <th
                key={i}
                className={`px-6 py-4 text-xs uppercase tracking-[0.2em] font-medium ${i >= 3 ? "text-right" : "text-left"}`}
                style={{ color: "rgba(255,255,255,0.50)" }}
              >
                {h}
              </th>
            ))}
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
            const cftEstimate = estimateCFT(p.collateral, p.leverage);
            return (
              <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td className="px-6 py-5 text-white font-medium">{MARKET_DISPLAY[p.market]}</td>
                <td className={`px-6 py-5 font-medium ${p.direction === "LONG" ? "text-emerald-300" : "text-red-300"}`}>
                  {p.direction}
                </td>
                <td className="px-6 py-5 tabular-nums" style={{ color: "rgba(255,255,255,0.70)" }}>{p.leverage}×</td>
                <td className="px-6 py-5 text-right text-white tabular-nums">
                  <div>~{cftEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })} CFT</div>
                  <CFTCountdown openedAt={p.openedAt} />
                </td>
                <td className="px-6 py-5 text-right tabular-nums" style={{ color: "rgba(255,255,255,0.80)" }}>{p.entryPrice.toFixed(4)}</td>
                <td className="px-6 py-5 text-right text-red-300 tabular-nums">{liqPrice.toFixed(4)}</td>
                <td className="px-6 py-5 text-right text-white tabular-nums">{cur.toFixed(4)}</td>
                <td className={`px-6 py-5 text-right tabular-nums font-medium ${v >= 0 ? "text-emerald-300" : "text-red-400"}`}>
                  {v.toFixed(4)} ETH
                </td>
                <td className="px-6 py-5 text-right">
                  <button
                    onClick={() => onClose(p.id, cur)}
                    disabled={closing === p.id}
                    className="px-4 py-2 rounded-full text-white text-xs border border-white/15 disabled:opacity-40 transition-colors hover:bg-white/10"
                    style={{ background: "rgba(255,255,255,0.05)" }}
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
