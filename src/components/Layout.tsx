import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Splash from "./Splash";

const SHOWN_KEY = "chainflux:splashShown";

export default function Layout({
  children,
  transparentNav = false,
  hideNav = false,
}: {
  children: React.ReactNode;
  transparentNav?: boolean;
  hideNav?: boolean;
}) {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SHOWN_KEY)) {
      setShowSplash(true);
    }
  }, []);

  const done = () => {
    sessionStorage.setItem(SHOWN_KEY, "1");
    setShowSplash(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showSplash && <Splash onDone={done} />}
      {!hideNav && <Navbar transparentOnTop={transparentNav} />}
      <main className="fade-in">{children}</main>
      <footer className="border-t border-white/5 mt-24">
        <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-white/40 flex flex-wrap items-center justify-between gap-2">
          <span>ChainFlux</span>
          <span className="text-white/30">Trade the heartbeat of blockchain</span>
        </div>
      </footer>
    </div>
  );
}
