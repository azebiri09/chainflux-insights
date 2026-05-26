import { useMemo } from "react";

export default function Candles({
  data,
  height = 280,
}: {
  data: number[];
  height?: number;
}) {
  const candles = useMemo(() => {
    const out: { o: number; h: number; l: number; c: number }[] = [];
    for (let i = 1; i < data.length; i++) {
      const o = data[i - 1];
      const c = data[i];
      const spread = Math.abs(c - o) * 0.6 + (Math.max(Math.abs(o), 0.1) * 0.015);
      const h = Math.max(o, c) + spread;
      const l = Math.min(o, c) - spread;
      out.push({ o, h, l, c });
    }
    return out;
  }, [data]);

  if (!candles.length) return null;

  const w = 800;
  const padY = 14;
  const min = Math.min(...candles.map((d) => d.l));
  const max = Math.max(...candles.map((d) => d.h));
  const range = max - min || 1;
  const scaleY = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2);
  const slotW = w / candles.length;
  const bodyW = Math.max(4, slotW * 0.55);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {/* horizontal grid */}
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={p}
          x1={0}
          x2={w}
          y1={padY + p * (height - padY * 2)}
          y2={padY + p * (height - padY * 2)}
          stroke="oklch(1 0 0 / 0.05)"
          strokeWidth={1}
        />
      ))}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? "oklch(0.78 0.16 155)" : "oklch(0.70 0.20 25)";
        const cx = i * slotW + slotW / 2;
        const yHigh = scaleY(c.h);
        const yLow = scaleY(c.l);
        const yO = scaleY(c.o);
        const yC = scaleY(c.c);
        const top = Math.min(yO, yC);
        const bH = Math.max(1.5, Math.abs(yC - yO));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.2} />
            <rect
              x={cx - bodyW / 2}
              y={top}
              width={bodyW}
              height={bH}
              fill={up ? color : color}
              opacity={up ? 0.95 : 0.95}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}
