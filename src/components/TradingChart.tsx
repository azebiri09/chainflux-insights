import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  data: number[];
  type: "line" | "candle";
  height?: number;
};

function toCandles(data: number[]) {
  const out: { o: number; h: number; l: number; c: number }[] = [];
  const groupSize = 3;
  for (let i = 0; i < data.length; i += groupSize) {
    const group = data.slice(i, i + groupSize);
    if (!group.length) continue;
    out.push({
      o: group[0],
      c: group[group.length - 1],
      h: Math.max(...group),
      l: Math.min(...group),
    });
  }
  return out;
}

export default function TradingChart({ data, type, height = 300 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const lastTouchRef = useRef<{ dist: number; offset: number } | null>(null);

  const w = 800;
  const padY = 20;
  const padX = 10;

  const visibleCount = Math.floor(30 * zoom);

  const allData = data.length >= 2 ? data : [
    ...Array(20).fill(0).map((_, i) => {
      const base = data[0] || 1;
      return base * (0.95 + Math.sin(i * 0.5) * 0.05 + Math.random() * 0.02);
    }),
    ...(data.length ? data : []),
  ];

  const maxOffset = Math.max(0, allData.length - visibleCount);
  const clampedOffset = Math.min(Math.max(0, offset), maxOffset);
  const visible = allData.slice(
    Math.max(0, allData.length - visibleCount - clampedOffset),
    allData.length - clampedOffset || undefined
  );

  const min = Math.min(...visible) * 0.998;
  const max = Math.max(...visible) * 1.002;
  const range = max - min || 1;
  const scaleY = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2);
  const up = visible.length >= 2 && visible[visible.length - 1] >= visible[0];
  const color = up ? "#4ade80" : "#f87171";

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startOffset: clampedOffset };
  }, [clampedOffset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = dragRef.current.startX - e.clientX;
    const newOffset = dragRef.current.startOffset + Math.round(dx / 20);
    setOffset(Math.min(Math.max(0, newOffset), maxOffset));
  }, [maxOffset]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // Touch drag
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startOffset: clampedOffset };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchRef.current = { dist, offset: clampedOffset };
    }
  }, [clampedOffset]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1 && dragRef.current) {
      const dx = dragRef.current.startX - e.touches[0].clientX;
      const newOffset = dragRef.current.startOffset + Math.round(dx / 15);
      setOffset(Math.min(Math.max(0, newOffset), maxOffset));
    } else if (e.touches.length === 2 && lastTouchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = lastTouchRef.current.dist / dist;
      setZoom((z) => Math.min(Math.max(0.3, z * scale), 4));
      lastTouchRef.current.dist = dist;
    }
  }, [maxOffset]);

  const onTouchEnd = useCallback(() => {
    dragRef.current = null;
    lastTouchRef.current = null;
  }, []);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(0.3, z + e.deltaY * 0.001)));
  }, []);

  if (type === "candle") {
    const candles = toCandles(visible);
    const slotW = (w - padX * 2) / Math.max(candles.length, 1);
    const bodyW = Math.max(4, slotW * 0.6);

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        style={{ cursor: "grab", touchAction: "none" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={padX} x2={w - padX}
            y1={padY + p * (height - padY * 2)}
            y2={padY + p * (height - padY * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? "#4ade80" : "#f87171";
          const cx = padX + i * slotW + slotW / 2;
          const yH = scaleY(c.h);
          const yL = scaleY(c.l);
          const yO = scaleY(c.o);
          const yC = scaleY(c.c);
          const top = Math.min(yO, yC);
          const bH = Math.max(2, Math.abs(yC - yO));
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={col} strokeWidth={1.5} opacity={0.7} />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bH} fill={col} rx={2} opacity={0.9} />
            </g>
          );
        })}
      </svg>
    );
  }

  // Line chart
  const scaleX = (i: number) => padX + (i / Math.max(visible.length - 1, 1)) * (w - padX * 2);
  const points = visible.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(" ");
  const area = [
    `${scaleX(0)},${height}`,
    ...visible.map((v, i) => `${scaleX(i)},${scaleY(v)}`),
    `${scaleX(visible.length - 1)},${height}`,
  ].join(" ");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ cursor: "grab", touchAction: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={padX} x2={w - padX}
          y1={padY + p * (height - padY * 2)}
          y2={padY + p * (height - padY * 2)}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      <polygon points={area} fill="url(#areaGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={scaleX(visible.length - 1)} cy={scaleY(visible[visible.length - 1])} r={4} fill={color} />
    </svg>
  );
      }
