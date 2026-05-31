import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWallet, connectWallet, disconnectWallet, shortAddr } from "@/lib/wallet";

const links = [
  { to: "/trade", label: "Trade" },
  { to: "/predict", label: "Predict" },
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
        solid ? "backdrop-blur-xl bg-[oklch(0.10_0.025_260)/0.6] border-b border-white/10" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-primary/20 border border-primary/40" />
          <span className="font-semibold tracking-tight text-white">ChainFlux</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                path === l.to ? "text-white bg-white/5" : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {wallet ? (
            <button
              onClick={disconnectWallet}
              className="hidden sm:inline-flex px-3 py-1.5 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10"
            >
              {shortAddr(wallet)}
            </button>
          ) : (
            <button
              onClick={() => connectWallet()}
              className="px-3 py-1.5 text-sm rounded-md bg-primary/90 hover:bg-primary text-white"
            >
              Connect Wallet
            </button>
          )}
          <button
            className="md:hidden p-2 text-white/80"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[oklch(0.16_0.03_260)]">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-md text-sm ${path === l.to ? "bg-white/10 text-white" : "text-white/80"}`}
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
