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
      { name: "description", content: "Trade gas fees and transaction throughput on Arbitrum in real time." },
    ],
  }),
});

const markets = [
  {
    code: "GAS",
    name: "Gas Price",
    desc: "Every transaction on Ethereum competes for blockspace. When demand spikes, gas goes up. When the network quiets down, it drops. Gas Price gives you a direct position on that pressure in real time.",
  },
  {
    code: "TXS_PER_BLOCK",
    name: "Transactions Per Block",
    desc: "This measures how many transactions are actually landing per block. When activity picks up across DeFi, NFTs, or anything else, this number climbs. It is one of the clearest signals of real onchain demand.",
  },
] as const;

const steps = [
  { title: "Pick a market", body: "Choose Gas Price or Transactions Per Block. Both update live from the Ethereum network." },
  { title: "Take a position", body: "Go long if you think the metric is going up. Go short if you think it is coming down. Set your collateral and leverage." },
  { title: "Watch it move", body: "The market moves with the network. If your read is right, you profit. If not, you lose. No expiry. No waiting." },
  { title: "Close when you want", body: "You control when you exit. There are no forced expiries. Just open positions reacting to live onchain data." },
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
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,1) 100%)" }} />
        <div className="relative w-full px-6 pt-32 pb-24 text-center rise">
          <h1 className="mt-8 text-5xl sm:text-7xl md:text-[5.5rem] font-semibold tracking-tight text-white leading-[1.02]">
            Markets powered by
            <br />
            <span className="text-white/60">onchain activity</span>
          </h1>
          <p className="mt-8 text-base sm:text-lg text-white/55 max-w-xl mx-auto leading-relaxed">
            Trade gas fees and transaction throughput on Arbitrum in real time. The network is the market.
          </p>
          <div className="mt-12">
            <button
              onClick={() => navigate({ to: "/trade" })}
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-colors text-sm tracking-wide"
            >
              Start Trading
              <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* What is ChainFlux */}
      <section className="w-full px-6 py-28 sm:py-36 max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-white/40 uppercase">What is ChainFlux</div>
        <h2 className="mt-5 text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.1]">
          A market for the things that actually move the chain.
        </h2>
        <p className="mt-8 text-white/60 text-lg leading-relaxed">
          Most crypto trading is just guessing whether a token goes up or down. ChainFlux is different. You are trading the raw activity underneath — how congested the network is, how many transactions are landing per block. These are the signals that experienced traders have always watched. Now you can take a position on them directly.
        </p>
        <p className="mt-6 text-white/60 text-lg leading-relaxed">
          When Ethereum gets busy, gas climbs. When users pile back in, transaction volume rises. Every one of those moments is now a market you can trade.
        </p>
      </section>

      {/* Markets */}
      <section className="w-full px-6 pb-24 max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-10">Markets</div>
        <div className="flex flex-col gap-6">
          {markets.map((m) => (
            <div key={m.code} className="glass rounded-2xl p-8">
              <div className="text-[10px] tracking-[0.3em] text-white/35 uppercase">{m.code}</div>
              <h3 className="mt-3 text-2xl font-semibold text-white tracking-tight">{m.name}</h3>
              <p className="mt-5 text-base text-white/60 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why it exists */}
      <section className="w-full px-6 py-24 max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-white/40 uppercase">Why it exists</div>
        <h2 className="mt-5 text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.1]">
          Price is the last thing to move.
        </h2>
        <p className="mt-8 text-white/60 text-lg leading-relaxed">
          By the time a token is rallying on your screen, the signal has already been sitting onchain for hours. Builders and serious traders have always watched gas and transaction flow to feel what the network is actually doing. ChainFlux puts a price on that feed so you can act on what you see the moment you see it, not after the candle has already printed.
        </p>
      </section>

      {/* How it works */}
      <section className="w-full px-6 py-20 max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-3">How it works</div>
        <h2 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Simple by design.</h2>
        <div className="mt-14 flex flex-col gap-5">
          {steps.map((s, i) => (
            <div key={i} className="glass rounded-2xl p-7 flex flex-col">
              <div className="text-[10px] tracking-[0.3em] text-white/35 uppercase mb-3">Step {i + 1}</div>
              <div className="text-white font-semibold text-lg mb-2">{s.title}</div>
              <p className="text-white/60 text-base leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Network feed preview */}
      <section className="w-full px-6 py-28 max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-3">Network Feed</div>
        <h2 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Live from the chain.</h2>
        <p className="mt-5 text-white/50 text-lg leading-relaxed">
          Watch gas and transaction activity update in real time. This is the data your positions are built on.
        </p>
        <div className="mt-12 flex flex-col gap-5">
          {(["GAS", "TXS_PER_BLOCK"] as const).map((k) => (
            <div key={k} className="glass rounded-2xl p-7">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] tracking-[0.3em] text-white/35 uppercase">{k.replace(/_/g, " ")}</div>
                <div className="text-xl text-white tabular-nums font-semibold">{all[k].current.toFixed(2)}</div>
              </div>
              <div className="mt-4 text-white/50">
                <Sparkline data={all[k].history} stroke="rgba(255,255,255,0.4)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="w-full px-6 py-24 max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-3">Leaderboard</div>
        <h2 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">Who is calling it right.</h2>
        <p className="mt-5 text-white/50 text-lg leading-relaxed">
          The best onchain traders, ranked by total PnL.
        </p>
        <div className="mt-12 glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-[10px] uppercase tracking-[0.25em]">
              <tr>
                <th className="text-left px-6 py-5">Rank</th>
                <th className="text-left px-6 py-5">Wallet</th>
                <th className="text-right px-6 py-5">Total PnL</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((r) => (
                <tr key={r.rank} className="border-t border-white/5">
                  <td className="px-6 py-5 text-white/70">#{r.rank}</td>
                  <td className="px-6 py-5 text-white font-mono text-xs">{r.addr}</td>
                  <td className="px-6 py-5 text-right text-emerald-400 tabular-nums font-semibold">{r.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full px-6 py-32 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.05]">
          The chain has a pulse. Trade it.
        </h2>
        <div className="mt-12">
          <button
            onClick={() => navigate({ to: "/trade" })}
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-colors text-sm tracking-wide"
          >
            Start Trading
            <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>

    </Layout>
  );
   }
