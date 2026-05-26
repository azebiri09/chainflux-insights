import { useEffect, useState } from "react";
import splashBg from "@/assets/splash-bg.jpg";

export default function Splash({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const dur = 2600;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(100, Math.round(((t - start) / dur) * 100));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(step);
      else {
        setTimeout(() => setFading(true), 200);
        setTimeout(onDone, 900);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center text-white ${fading ? "fade-out" : ""}`}
      style={{
        backgroundImage: `linear-gradient(to bottom, oklch(0.10 0.03 260 / 0.85), oklch(0.10 0.03 260 / 0.95)), url(${splashBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="px-6 text-center max-w-md w-full">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">ChainFlux</h1>
        <p className="mt-3 text-sm sm:text-base text-white/60">Trade the heartbeat of blockchain</p>

        <div className="my-10 flex justify-center">
          <div className="relative h-40 w-40 sm:h-48 sm:w-48">
            <div className="absolute inset-0 blob-shape" />
            <div className="absolute inset-4 blob-shape" style={{ animationDelay: "-3s", opacity: 0.6 }} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-white/70 transition-all duration-150" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs tabular-nums text-white/60 w-10 text-right">{pct}%</div>
        </div>
      </div>
    </div>
  );
}
