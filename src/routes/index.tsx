import { createFileRoute, Link } from "@tanstack/react-router";
import Layout from "@/components/Layout";
import Sparkline from "@/components/Sparkline";
import { useAllMarkets } from "@/lib/markets";
import heroBg from "@/assets/hero-bg.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ChainFlux — Trade the heartbeat of blockchain" },
      { name: "description", content: "Trade gas fees, network usage, and capital movement on Arbitrum in real time." },
    ],
  }),
});

const markets = [
  { code: "GAS", name: "Network Congestion", desc: "Trade Arbitrum gas in real time.", sub: "As network activity rises, fees react instantly." },
  { code: "ACTIVITY", name: "Transaction Volume", desc: "Trade the pace of onchain activity.", sub: "Follow transaction volume as usage across the network accelerates or slows down." },
  { code: "FLOW", name: "ETH Movement on Arbitrum", desc: "Track capital moving across Arbitrum.", sub: "Trade live ETH inflows, outflows, and ecosystem momentum." },
] as const;

const steps = [
  "Pick a market and take a position.",
  "If the metric moves your way, you profit. If not, you lose.",
  "Open and close trades anytime with live pricing.",
  "No expiry dates or forced liquidations.",
];

const leaderboard = [
  { rank: 1, addr: "0x9a3f…42c1", pnl: "+128,420" },
  { rank: 2, addr: "0x71be…0d9f", pnl: "+96,118" },
  { rank: 3, addr: "0x4d2c…aa7e", pnl: "+74,902" },
  { rank: 4, addr: "0xbb01…5e22", pnl: "+58,330" },
  { rank: 5, addr: "0x10f8…91cd", pnl: "+42,775" },
];

function Index() {
  const all = useAllMarkets();
  return (
    <Layout transparentNav>
      {/* Hero */}
      <section
        className="relative min-h-[100svh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, oklch(0.10 0.03 260 / 0.78), oklch(0.16 0.03 260 / 0.95)), url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto max-w-5xl px-6 pt-28 pb-16 text-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white">
            Markets powered by onchain activity
          </h1>
          <p className="mt-6 text-base sm:text-lg text-white/70 max-w-2xl mx-auto">
            Trade gas fees, network usage, and capital movement on Arbitrum in real time.
          </p>
          <div className="mt-10">
            <Link
              to="/trade"
              className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
            >
              Start Trading
            </Link>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="grid gap-5 md:grid-cols-3">
          {markets.map((m) => (
            <div key={m.code} className="rounded-xl bg-card p-6 border border-white/5">
              <div className="text-xs tracking-widest text-primary/80">{m.code}</div>
              <h3 className="mt-2 text-xl font-semibold text-white">{m.name}</h3>
              <p className="mt-4 text-sm text-white/70">{m.desc}</p>
              <p className="mt-2 text-sm text-white/50">{m.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">How It Works</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl bg-card/60 p-6 border border-white/5">
              <div className="text-sm text-primary/80">Step {i + 1}</div>
              <p className="mt-3 text-white/85">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Network feed preview */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">Network Feed</h2>
        <p className="mt-3 text-white/60 max-w-2xl">
          A live market for Arbitrum activity. Track GAS, ACTIVITY, and FLOW as the chain moves in real time.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {(["GAS", "ACTIVITY", "FLOW"] as const).map((k) => (
            <div key={k} className="rounded-xl bg-card p-5 border border-white/5">
              <div className="flex items-baseline justify-between">
                <div className="text-xs tracking-widest text-white/50">{k}</div>
                <div className="text-lg text-white tabular-nums">{all[k].current.toFixed(2)}</div>
              </div>
              <div className="mt-3 text-primary/80">
                <Sparkline data={all[k].history} stroke="oklch(0.75 0.10 245)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">Leaderboard</h2>
        <p className="mt-3 text-white/60 max-w-2xl">
          See who is calling the market correctly. Where the best onchain traders stand out.
        </p>
        <div className="mt-8 overflow-hidden rounded-xl bg-card border border-white/5">
          <table className="w-full text-sm">
            <thead className="text-white/50 text-xs uppercase tracking-wider">
              <tr><th className="text-left p-4">Rank</th><th className="text-left p-4">Wallet</th><th className="text-right p-4">Total PnL</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((r, i) => (
                <tr key={r.rank} className={i % 2 ? "bg-white/[0.02]" : ""}>
                  <td className="p-4 text-white/80">#{r.rank}</td>
                  <td className="p-4 text-white font-mono">{r.addr}</td>
                  <td className="p-4 text-right text-emerald-400/90 tabular-nums">{r.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
