import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  { code: "ACTIVE_ADDRESSES", name: "Active Addresses", desc: "Trade the number of unique addresses active per block.", sub: "Follow participation as network activity accelerates or slows down." },
  { code: "TXS_PER_BLOCK", name: "Transactions Per Block", desc: "Track onchain throughput across Arbitrum.", sub: "Trade live transaction density as the network heats up or cools down." },
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
  const navigate = useNavigate();
  return (
    <Layout hideNav>
      {/* Hero */}
      <section className="relative min-h-[100svh] flex items-center overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, transparent 0%, oklch(0.08 0.02 260 / 0.55) 60%, oklch(0.06 0.02 260 / 0.95) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, oklch(0.06 0.02 260 / 0.45) 0%, transparent 35%, transparent 60%, oklch(0.08 0.02 260 / 0.95) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pt-32 pb-24 text-center rise">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-[11px] tracking-[0.25em] text-white/70 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
            Live on Arbitrum
          </div>
          <h1 className="mt-8 text-5xl sm:text-7xl md:text-[5.5rem] font-semibold tracking-tight text-white leading-[1.02]">
            Markets powered by
            <br />
            <span className="text-white/70">onchain activity</span>
          </h1>
          <p className="mt-8 text-base sm:text-lg text-white/65 max-w-2xl mx-auto leading-relaxed">
            Trade gas fees, network usage, and capital movement on Arbitrum in real time.
          </p>
          <div className="mt-12">
            <button
              onClick={() => navigate({ to: "/trade" })}
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-[oklch(0.12_0.03_260)] font-medium hover:bg-white/90 transition-colors text-sm tracking-wide shadow-[0_20px_60px_-20px_oklch(0.85_0.06_245/0.45)]"
            >
              Start Trading
              <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* What is ChainFlux */}
      <section className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
        <div className="text-xs tracking-[0.3em] text-primary/80 uppercase">What is ChainFlux</div>
        <h2 className="mt-5 text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.1]">
          A market for the things that actually move the chain.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 text-white/70 text-base leading-relaxed">
          <p>
            Crypto has never had a clean way to trade what really matters underneath the price — the demand
            for blockspace, the pace of activity, the flow of capital. ChainFlux turns those raw onchain
            signals into liquid markets you can take a position on.
          </p>
          <p>
            Instead of betting on whether a token goes up or down, you trade the network itself.
            When Arbitrum heats up, gas climbs. When users come back, transactions per block rises.
            When participation surges, active addresses follow. Every one of those moments is now tradable.
          </p>
        </div>
      </section>

      {/* Markets */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {markets.map((m) => (
            <div key={m.code} className="glass rounded-2xl p-7">
              <div className="text-[10px] tracking-[0.3em] text-primary/80 uppercase">{m.code}</div>
              <h3 className="mt-3 text-2xl font-semibold text-white tracking-tight">{m.name}</h3>
              <p className="mt-5 text-sm text-white/75 leading-relaxed">{m.desc}</p>
              <p className="mt-3 text-sm text-white/50 leading-relaxed">{m.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why it exists */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-xs tracking-[0.3em] text-primary/80 uppercase">Why it exists</div>
        <h2 className="mt-5 text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.1]">
          Price is the last thing to move.
        </h2>
        <p className="mt-8 text-white/70 text-lg leading-relaxed max-w-3xl">
          By the time a token rallies, the signal has already been onchain for hours. Builders, analysts and
          serious traders have always watched gas, transactions and flow to feel the network in real time.
          ChainFlux gives that feed a price — so you can trade conviction the moment you see it, not after
          the candle has already printed.
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">How It Works</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={i} className="glass rounded-2xl p-7 min-h-[180px] flex flex-col">
              <div className="text-[10px] tracking-[0.3em] text-primary/80 uppercase">Step {i + 1}</div>
              <p className="mt-5 text-white/85 text-base leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Network feed preview */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <h2 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Network Feed</h2>
        <p className="mt-5 text-white/60 max-w-2xl text-lg leading-relaxed">
          A live market for Arbitrum activity. Track GAS, ACTIVE ADDRESSES, and TXS PER BLOCK as the chain moves in real time.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {(["GAS", "ACTIVE_ADDRESSES", "TXS_PER_BLOCK"] as const).map((k) => (
            <div key={k} className="glass rounded-2xl p-6">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] tracking-[0.3em] text-white/50 uppercase">{k.replace(/_/g, " ")}</div>
                <div className="text-xl text-white tabular-nums font-medium">{all[k].current.toFixed(2)}</div>
              </div>
              <div className="mt-4 text-primary/80">
                <Sparkline data={all[k].history} stroke="oklch(0.78 0.10 245)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Leaderboard</h2>
        <p className="mt-5 text-white/60 max-w-2xl text-lg leading-relaxed">
          See who is calling the market correctly. Where the best onchain traders stand out.
        </p>
        <div className="mt-12 glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-white/50 text-[10px] uppercase tracking-[0.25em]">
              <tr>
                <th className="text-left px-6 py-5">Rank</th>
                <th className="text-left px-6 py-5">Wallet</th>
                <th className="text-right px-6 py-5">Total PnL</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((r) => (
                <tr key={r.rank} className="border-t border-white/5">
                  <td className="px-6 py-5 text-white/80">#{r.rank}</td>
                  <td className="px-6 py-5 text-white font-mono text-xs">{r.addr}</td>
                  <td className="px-6 py-5 text-right text-emerald-300/90 tabular-nums">{r.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-32 text-center">
        <h2 className="text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.05]">
          The chain has a pulse. Trade it.
        </h2>
        <div className="mt-12">
          <button
            onClick={() => navigate({ to: "/trade" })}
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-[oklch(0.12_0.03_260)] font-medium hover:bg-white/90 transition-colors text-sm tracking-wide"
          >
            Start Trading
            <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>
    </Layout>
  );
            }
