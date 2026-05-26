import Navbar from "./Navbar";

export default function Layout({
  children,
  transparentNav = false,
  hideNav = false,
}: {
  children: React.ReactNode;
  transparentNav?: boolean;
  hideNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
