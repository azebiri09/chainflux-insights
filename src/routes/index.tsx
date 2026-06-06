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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');
        .headline { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

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
        <div className="relative w-full px-5 sm:px-10 pt-32 pb-24 text-center rise">
          <h1 className="headline mt-8 text-5xl sm:text-7xl md:text-[5.5rem] font-semibold tracking-tight text-white leading-[1.08]">
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
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-5 font-semibold">What is ChainFlux</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-8">
          A perpetual trading platform for Ethereum network activity.
        </h2>
        <div className="space-y-5 text-white/60 text-base sm:text-lg leading-relaxed">
          <p>Most trading platforms let you speculate on the price of assets like ETH, BTC, or other tokens. ChainFlux is different.</p>
          <p>Instead of trading token prices, you trade the metrics that describe what is happening on the Ethereum network itself.</p>
          <p>Metrics like Gas Price and Transactions Per Block update continuously from live blockchain data and can be traded long or short using leverage.</p>
          <p className="text-white/80 font-medium">ChainFlux turns blockchain activity into a market.</p>
        </div>
      </section>

      {/* Markets */}
      <section className="w-full px-5 sm:px-10 pb-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-8 font-semibold">Markets</div>
        <div className="flex flex-col gap-6">

          <div className="glass rounded-2xl p-8">
            <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-3">Gas</div>
            <h3 className="headline text-2xl sm:text-3xl font-semibold text-white mb-5">Gas Price</h3>
            <div className="space-y-3 text-white/60 text-base leading-relaxed">
              <p>Gas Price measures how much users are willing to pay to have their transactions included on Ethereum.</p>
              <p>When network demand increases, gas prices tend to rise. When activity slows, gas prices tend to fall.</p>
              <p>ChainFlux allows traders to take positions on whether gas prices will move higher or lower.</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-3">TXS_PER_BLOCK</div>
            <h3 className="headline text-2xl sm:text-3xl font-semibold text-white mb-5">Transactions Per Block</h3>
            <div className="space-y-3 text-white/60 text-base leading-relaxed">
              <p>Transactions Per Block measures how many transactions are included in each Ethereum block.</p>
              <p>Higher values generally indicate increased network activity, while lower values suggest reduced activity.</p>
              <p>ChainFlux allows traders to speculate on changes in transaction volume as activity across the network evolves.</p>
            </div>
          </div>

        </div>
      </section>

      {/* Why it exists */}
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-5 font-semibold">Why it exists</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-8">
          Price is the last thing to move.
        </h2>
        <div className="space-y-5 text-white/60 text-base sm:text-lg leading-relaxed">
          <p>Blockchains generate massive amounts of real time data, but most of that data cannot be traded directly.</p>
          <p>Traders often monitor metrics such as gas usage and transaction activity to better understand what is happening across the network.</p>
          <p>ChainFlux transforms these metrics into tradeable markets, allowing users to express views on network activity itself rather than only on token prices.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full px-5 sm:px-10 py-20 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-3 font-semibold">How it works</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-12">Simple by design.</h2>
        <div className="flex flex-col gap-5">
          {[
            {
              step: "Step 1",
              title: "Choose a market.",
              body: "Select Gas Price or Transactions Per Block. Both markets are powered by live Ethereum network data.",
            },
            {
              step: "Step 2",
              title: "Open a position.",
              body: "Go long if you expect the metric to increase. Go short if you expect it to decrease. Choose your collateral and leverage.",
            },
            {
              step: "Step 3",
              title: "Monitor the market.",
              body: "Your position moves as the underlying network metric changes in real time.",
            },
            {
              step: "Step 4",
              title: "Close your position.",
              body: "Exit whenever you choose and realize your profit or loss. There are no fixed expiries and no waiting for settlement.",
            },
          ].map((s, i) => (
            <div key={i} className="glass rounded-2xl p-7 sm:p-8">
              <div className="text-xs tracking-[0.3em] text-white/40 uppercase mb-3">{s.step}</div>
              <div className="headline text-xl sm:text-2xl font-semibold text-white mb-3">{s.title}</div>
              <p className="text-white/60 text-base leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Network feed preview */}
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-3 font-semibold">Network Feed</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-5">Live from the chain.</h2>
        <p className="text-white/50 text-base sm:text-lg leading-relaxed mb-12">
          Watch gas and transaction activity update in real time. This is the data your positions are built on.
        </p>
        <div className="flex flex-col gap-5">
          {(["GAS", "TXS_PER_BLOCK"] as const).map((k) => (
            <div key={k} className="glass rounded-2xl p-7">
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-xs tracking-[0.3em] text-white/40 uppercase">{k.replace(/_/g, " ")}</div>
                <div className="text-xl text-white tabular-nums font-semibold">{all[k].current.toFixed(2)}</div>
              </div>
              <div className="text-white/50">
                <Sparkline data={all[k].history} stroke="rgba(255,255,255,0.4)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-3 font-semibold">Leaderboard</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-5">Who is calling it right.</h2>
        <p className="text-white/50 text-base sm:text-lg leading-relaxed mb-12">
          The best onchain traders, ranked by total PnL.
        </p>
        <div className="glass rounded-2xl overflow-hidden">
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
      <section className="w-full px-5 sm:px-10 py-32 text-center max-w-4xl mx-auto">
        <h2 className="headline text-4xl sm:text-6xl font-semibold text-white leading-[1.1]">
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
