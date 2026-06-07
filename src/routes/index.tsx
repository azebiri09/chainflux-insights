import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Layout from "@/components/Layout";
import Sparkline from "@/components/Sparkline";
import { useAllMarkets } from "@/lib/markets";
import heroBg from "@/assets/hero-bg.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ChainFlux — Where blockchain activity becomes a market." },
      { name: "description", content: "Blockchain data has always been observable but never tradeable. ChainFlux is the first market for it." },
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
        .hero-text { color: #ffffff !important; }
        .hero-subtext { color: rgba(255,255,255,0.55) !important; }
        .hero-span { color: rgba(255,255,255,0.60) !important; }
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
          <h1 className="headline hero-text mt-8 text-5xl sm:text-7xl md:text-[5.5rem] font-semibold tracking-tight leading-[1.08]">
            Observe it. Understand it.
            <br />
            <span className="hero-span">Trade it.</span>
          </h1>
          <p className="hero-subtext mt-8 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Blockchain data is everywhere, but it's hard to understand what actually matters. ChainFlux turns raw onchain activity into a live Attention Market, showing where demand, capital, and network activity are moving in real time.
          </p>
          <div className="mt-12">
            <button
              onClick={() => navigate({ to: "/feed" })}
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-colors text-sm tracking-wide"
            >
              Enter ChainFlux
              <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-5 font-semibold">Markets</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-12">
          Markets powered by blockchain activity.
        </h2>
        <div className="flex flex-col gap-6">

          <div className="glass rounded-2xl p-8">
            <h3 className="headline text-2xl sm:text-3xl font-semibold text-white mb-5">Gas Price</h3>
            <p className="text-white/60 text-base leading-relaxed">
              A real time market for Ethereum block space, where the cost of including transactions changes based on network demand and congestion. It reflects how competitive execution on the network becomes as activity rises or falls.
            </p>
          </div>

          <div className="glass rounded-2xl p-8">
            <h3 className="headline text-2xl sm:text-3xl font-semibold text-white mb-5">Transactions Per Block</h3>
            <p className="text-white/60 text-base leading-relaxed">
              A market that represents Ethereum's network throughput by measuring how many transactions are processed in each block. It shifts with overall usage across applications, users, and protocols interacting with the chain.
            </p>
          </div>

        </div>
      </section>

      {/* Why ChainFlux exists */}
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-5 font-semibold">Why ChainFlux exists</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-8">
          Most platforms show you blockchain data. ChainFlux helps you understand what it means.
        </h2>
        <div className="space-y-5 text-white/60 text-base sm:text-lg leading-relaxed">
          <p>Most blockchain data today is scattered across explorers, dashboards, and analytics tools. You can see what is happening, but you still need experience to understand what it means. That creates a gap between data and action.</p>
          <p>ChainFlux exists to close that gap. It turns raw onchain activity into clear, real time Attention signals so anyone can understand network demand, capital flow, and momentum at a glance.</p>
          <p>And for the signals that move fast enough, you can trade them directly through perpetual markets.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full px-5 sm:px-10 py-20 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-3 font-semibold">How it works</div>
        <div className="flex flex-col gap-5 mt-8">
          {[
            {
              step: "Step 1",
              title: "Enter ChainFlux.",
              body: "Land in the Attention Layer and see real time Ethereum activity through interpreted signals like gas, transactions, and network demand.",
            },
            {
              step: "Step 2",
              title: "Understand what is happening.",
              body: "ChainFlux turns raw onchain data into clear attention signals that show where activity, capital, and usage are moving.",
            },
            {
              step: "Step 3",
              title: "Move from signal to action.",
              body: "When a signal becomes strong enough, shift into the Trading Layer to take a position on Gas Price or Transactions Per Block.",
            },
            {
              step: "Step 4",
              title: "Trade the signal.",
              body: "Open and close perpetual positions based on how network activity evolves, with no expiries or fixed settlement time.",
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

      {/* Attention Layer preview */}
      <section className="w-full px-5 sm:px-10 py-24 max-w-4xl mx-auto">
        <div className="text-base tracking-[0.2em] text-white/60 uppercase mb-3 font-semibold">Attention Layer</div>
        <h2 className="headline text-4xl sm:text-5xl font-semibold text-white leading-[1.12] mb-5">Live Attention From Ethereum.</h2>
        <p className="text-white/50 text-base sm:text-lg leading-relaxed mb-12">
          Blockchain activity is more than raw numbers. Every transaction and wallet interaction contributes to a live signal of where attention is flowing across Ethereum.
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
      <section className="w-full px-5 sm:px-10 py-32 max-w-4xl mx-auto">
        <h2 className="headline text-4xl sm:text-6xl font-semibold text-white leading-[1.1]">
          Most platforms show you blockchain data.
          <br />
          <span className="hero-span">ChainFlux helps you understand what it means.</span>
        </h2>
        <p className="mt-8 text-white/50 text-base sm:text-lg max-w-2xl leading-relaxed">
          Blockchain data has always been visible but never truly understood. ChainFlux turns it into a live Attention Market, helping you see what matters and trade the signals that move fast enough.
        </p>
        <div className="mt-12">
          <button
            onClick={() => navigate({ to: "/feed" })}
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-colors text-sm tracking-wide"
          >
            Enter ChainFlux
            <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>

    </Layout>
  );
              }
