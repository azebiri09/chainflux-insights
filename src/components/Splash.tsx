import { useEffect, useState } from "react";
import splashBg from "@/assets/splash-bg.jpg";

export default function Splash({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const dur = 5000;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(100, Math.round(((t - start) / dur) * 100));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(step);
      else {
        setTimeout(() => setFading(true), 250);
        setTimeout(onDone, 950);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center text-white overflow-hidden ${fading ? "fade-out" : ""}`}
    >
      {/* Planet background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${splashBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Atmospheric overlays for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, transparent 0%, oklch(0.10 0.03 260 / 0.35) 55%, oklch(0.06 0.02 260 / 0.85) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.06 0.02 260 / 0.55) 0%, transparent 30%, transparent 70%, oklch(0.06 0.02 260 / 0.85) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-8 text-center w-full max-w-md flex flex-col items-center">
        {/* Animated layered blob */}
        <div className="mb-14 flex justify-center">
          <div className="relative h-44 w-44 sm:h-56 sm:w-56 blob-drift">
            <div className="absolute inset-0 blob-a" />
            <div className="absolute inset-3 blob-b" />
            <div className="absolute inset-8 blob-a" style={{ animationDelay: "-4s", opacity: 0.7 }} />
          </div>
        </div>

        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight">ChainFlux</h1>
        <p className="mt-4 text-sm sm:text-base text-white/55 tracking-wide">
          Trade the heartbeat of blockchain
        </p>

        <div className="mt-16 w-full max-w-xs">
          <div className="relative h-[3px] rounded-full bg-white/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/85 transition-[width] duration-150 ease-out"
              style={{ width: `${pct}%`, boxShadow: "0 0 12px oklch(0.85 0.06 245 / 0.4)" }}
            />
          </div>
          <div className="mt-4 flex justify-between text-[10px] tracking-[0.3em] text-white/45 uppercase">
            <span>Loading</span>
            <span className="tabular-nums">{pct.toString().padStart(3, "0")}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
