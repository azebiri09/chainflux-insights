import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Splash from "./Splash";

const SHOWN_KEY = "chainflux:splashShown";

export default function Layout({ children, transparentNav = false }: { children: React.ReactNode; transparentNav?: boolean }) {
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
      <Navbar transparentOnTop={transparentNav} />
      <main className="fade-in">{children}</main>
      <footer className="border-t border-white/5 mt-16">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-white/40">ChainFlux</div>
      </footer>
    </div>
  );
}
