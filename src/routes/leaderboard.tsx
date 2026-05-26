import { createFileRoute } from "@tanstack/react-router";
import Layout from "@/components/Layout";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Leaderboard — ChainFlux" }] }),
});

const rows = [
  { rank: 1, addr: "0x9a3f7b21c8d4e5f6789012345678abcd1234ef42c1", pnl: 128420, best: 24310, trades: 142 },
  { rank: 2, addr: "0x71be3c44a9d12b876543ef9876543210abcdef0d9f", pnl: 96118, best: 18420, trades: 119 },
  { rank: 3, addr: "0x4d2c8b9a7e6f5d4c3b2a1908f7e6d5c4b3a2aa7e", pnl: 74902, best: 15820, trades: 97 },
  { rank: 4, addr: "0xbb019283746555fae8c4b9a01234567890abc5e22", pnl: 58330, best: 12100, trades: 88 },
  { rank: 5, addr: "0x10f8a2b3c4d5e6f7081928374655ef9876543291cd", pnl: 42775, best: 9820, trades: 76 },
  { rank: 6, addr: "0xee21abcdef0123456789aabbccdd0099887766feaa", pnl: 38110, best: 8740, trades: 71 },
  { rank: 7, addr: "0x3c7d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e", pnl: 31420, best: 7110, trades: 65 },
  { rank: 8, addr: "0x88aa9bb7cc6dd5ee4ff3001122334455667788cc99", pnl: 24990, best: 5980, trades: 58 },
  { rank: 9, addr: "0x5612348765abcdef098765432100fedcba9876543e", pnl: 18840, best: 4720, trades: 49 },
  { rank: 10, addr: "0xaaaa9999888877776666555544443333222211110000", pnl: 12330, best: 3210, trades: 41 },
];

function short(a: string) { return a.slice(0, 6) + "…" + a.slice(-4); }

function LeaderboardPage() {
  return (
    <Layout>
      <div className="pt-24 pb-16 mx-auto max-w-7xl px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Leaderboard</h1>
        <p className="mt-3 text-white/60 max-w-2xl">
          See who is calling the market correctly. Where the best onchain traders stand out.
        </p>
        <div className="mt-8 rounded-xl overflow-hidden border border-white/5 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-4">Rank</th>
                  <th className="text-left p-4">Wallet</th>
                  <th className="text-right p-4">Total PnL</th>
                  <th className="text-right p-4">Best Trade</th>
                  <th className="text-right p-4"># Trades</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.rank} className={i % 2 ? "bg-white/[0.02]" : ""}>
                    <td className="p-4 text-white/80">#{r.rank}</td>
                    <td className="p-4 text-white font-mono">{short(r.addr)}</td>
                    <td className="p-4 text-right text-emerald-300 tabular-nums">+{r.pnl.toLocaleString()}</td>
                    <td className="p-4 text-right text-white tabular-nums">+{r.best.toLocaleString()}</td>
                    <td className="p-4 text-right text-white/80 tabular-nums">{r.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
