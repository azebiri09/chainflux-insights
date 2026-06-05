import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { ethers } from "ethers";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Leaderboard — ChainFlux" }] }),
});

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";

const CHAINFLUX_ABI = [
  "function getTierInfo(address user) view returns (uint8 tier, uint256 cftBalance, uint8 maxLeverage, uint256 nextTierThreshold)",
  "event PositionClosed(uint256 indexed id, address indexed trader, int256 pnl, uint256 payout, uint256 cftRewarded)",
];

const TIER_NAMES = ["Unranked", "Bronze", "Silver", "Gold", "Diamond"];
const TIER_COLORS = ["#ffffff40", "#cd7f32", "#c0c0c0", "#ffd700", "#a8d8f0"];

interface TraderRow {
  addr: string;
  totalPnl: number;
  bestTrade: number;
  trades: number;
  tier: number;
}

function short(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function TierBadge({ tier }: { tier: number }) {
  if (tier === 0) return null;
  return (
    <span
      className="ml-2 text-[9px] tracking-[0.15em] uppercase font-semibold px-2 py-0.5 rounded-full border"
      style={{
        color: TIER_COLORS[tier],
        borderColor: TIER_COLORS[tier] + "50",
        background: TIER_COLORS[tier] + "15",
      }}
    >
      {TIER_NAMES[tier]}
    </span>
  );
}

async function fetchLeaderboard(): Promise<TraderRow[]> {
  const provider = new ethers.JsonRpcProvider(
    "https://sepolia-rollup.arbitrum.io/rpc"
  );
  const contract = new ethers.Contract(PROXY_ADDRESS, CHAINFLUX_ABI, provider);

  const filter = contract.filters.PositionClosed();
  const events = await contract.queryFilter(filter, -100000);

  const map: Record<string, { totalPnl: number; bestTrade: number; trades: number }> = {};

  for (const e of events) {
    if (!("args" in e)) continue;
    const trader = (e.args.trader as string).toLowerCase();
    const rawPnl = Number(ethers.formatUnits(e.args.pnl as bigint, 18));
    if (!map[trader]) map[trader] = { totalPnl: 0, bestTrade: 0, trades: 0 };
    map[trader].totalPnl += rawPnl;
    map[trader].trades += 1;
    if (rawPnl > map[trader].bestTrade) map[trader].bestTrade = rawPnl;
  }

  const traders = Object.keys(map);
  if (traders.length === 0) return [];

  const tierCalls = traders.map((addr) =>
    contract.getTierInfo(addr)
      .then((r: any) => ({ addr, tier: Number(r[0]) }))
      .catch(() => ({ addr, tier: 0 }))
  );
  const tiers = await Promise.all(tierCalls);
  const tierMap: Record<string, number> = {};
  for (const t of tiers) tierMap[t.addr] = t.tier;

  const rows: TraderRow[] = traders.map((addr) => ({
    addr,
    totalPnl: map[addr].totalPnl,
    bestTrade: map[addr].bestTrade,
    trades: map[addr].trades,
    tier: tierMap[addr] ?? 0,
  }));

  rows.sort((a, b) => b.totalPnl - a.totalPnl);
  return rows.slice(0, 20);
}

function LeaderboardPage() {
  const [rows, setRows] = useState<TraderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setRows)
      .catch((e) => setError(e?.message || "Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="pt-32 pb-20 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-xs tracking-[0.3em] text-primary/80 uppercase">Leaderboard</div>
        <h1 className="mt-5 text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.05]">
          Who's calling the market.
        </h1>
        <p className="mt-6 text-white/60 max-w-2xl text-lg leading-relaxed">
          Real onchain traders, ranked by total realized PnL. Tier badges earned through CFT holdings.
        </p>

        <div className="mt-12 glass rounded-2xl overflow-hidden">
          {loading && (
            <div className="p-8 text-sm text-white/40">Loading onchain data...</div>
          )}

          {error && (
            <div className="p-8 text-sm text-red-400/70">{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="p-8 text-sm text-white/40">
              No closed positions yet. Be the first on the leaderboard.
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">Rank</th>
                    <th className="text-left p-4">Wallet</th>
                    <th className="text-right p-4">Total PnL</th>
                    <th className="text-right p-4">Best Trade</th>
                    <th className="text-right p-4">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.addr} className="border-t border-white/5">
                      <td className="px-6 py-5 text-white/60 tabular-nums">#{i + 1}</td>
                      <td className="px-6 py-5">
                        <span className="text-white font-mono text-xs">{short(r.addr)}</span>
                        <TierBadge tier={r.tier} />
                      </td>
                      <td className={`px-6 py-5 text-right tabular-nums font-medium ${r.totalPnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {r.totalPnl >= 0 ? "+" : ""}
                        {r.totalPnl.toFixed(4)} ETH
                      </td>
                      <td className="px-6 py-5 text-right text-white tabular-nums">
                        {r.bestTrade > 0 ? `+${r.bestTrade.toFixed(4)} ETH` : "—"}
                      </td>
                      <td className="px-6 py-5 text-right text-white/70 tabular-nums">{r.trades}</td>
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
