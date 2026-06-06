import Navbar from "./Navbar";
import { useEffect, useState } from "react";

export default function Layout({
  children,
  transparentNav = false,
  hideNav = false,
}: {
  children: React.ReactNode;
  transparentNav?: boolean;
  hideNav?: boolean;
}) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNav && <Navbar transparentOnTop={transparentNav} theme={theme} onToggleTheme={toggle} />}
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
