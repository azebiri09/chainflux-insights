import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWallet, connectWallet, disconnectWallet, shortAddr } from "@/lib/wallet";

const links = [
  { to: "/trade", label: "Trade" },
  { to: "/feed", label: "Network Feed" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/portfolio", label: "Portfolio" },
] as const;

export default function Navbar({ transparentOnTop = false }: { transparentOnTop?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const wallet = useWallet();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = !transparentOnTop || scrolled;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        solid ? "backdrop-blur-xl bg-black/80 border-b border-white/10" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/20" />
          <span className="text-lg font-bold tracking-tight text-white">ChainFlux</span>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                path === l.to
                  ? "text-white bg-white/10 border border-white/15"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {wallet ? (
            <button
              onClick={disconnectWallet}
              className="hidden sm:inline-flex px-4 py-2 text-sm font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              {shortAddr(wallet)}
            </button>
          ) : (
            <button
              onClick={() => connectWallet()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-black hover:bg-white/90 transition-colors"
            >
              Connect Wallet
            </button>
          )}
          <button
            className="md:hidden p-2 text-white/80"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-black/90">
          <div className="px-6 py-4 flex flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  path === l.to ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
            }
