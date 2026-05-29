import { useRef, useState, useCallback, useEffect } from "react";

type Props = {
  data: number[];
  timeframe: "1m" | "5m" | "15m" | "1h";
  type: "line" | "candle";
  height?: number;
  entryPrice?: number;
  liquidationPrice?: number;
  direction?: "LONG" | "SHORT";
};

// Ticks per candle at 3s polling interval
const TICKS_PER_CANDLE: Record<string, number> = {
  "1m": 20,   // 60s / 3s
  "5m": 100,  // 300s / 3s
  "15m": 300, // 900s / 3s
  "1h": 1200, // 3600s / 3s
};

const MAX_VISIBLE_CANDLES = 40;

function toCandles(data: number[], ticksPerCandle: number) {
  const out: { o: number; h: number; l: number; c: number }[] = [];
  for (let i = 0; i < data.length; i += ticksPerCandle) {
    const group = data.slice(i, i + ticksPerCandle);
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

export default function TradingChart({
  data,
  timeframe,
  type,
  height = 300,
  entryPrice,
  liquidationPrice,
  direction,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [candleOffset, setCandleOffset] = useState(0); // how many candles from right we've panned
  const [zoom, setZoom] = useState(1); // 1 = default 40 candles visible
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const lastTouchRef = useRef<{ dist: number } | null>(null);

  // Reset pan when timeframe changes
  useEffect(() => { setCandleOffset(0); }, [timeframe]);

  const w = 800;
  const padY = 20;
  const padX = 10;
  const labelW = 72;
  const chartW = w - labelW;

  const ticksPerCandle = TICKS_PER_CANDLE[timeframe];
  const allCandles = type === "candle" ? toCandles(data, ticksPerCandle) : [];
  const visibleCandleCount = Math.max(4, Math.round(MAX_VISIBLE_CANDLES / zoom));
  const maxCandleOffset = Math.max(0, allCandles.length - visibleCandleCount);
  const clampedCandleOffset = Math.min(Math.max(0, candleOffset), maxCandleOffset);

  // For line chart — show last N ticks based on timeframe
  const lineTickCount = Math.max(20, Math.round((ticksPerCandle * 10) / zoom));
  const maxLineOffset = Math.max(0, data.length - lineTickCount);
  const clampedLineOffset = Math.min(Math.max(0, candleOffset * ticksPerCandle), maxLineOffset);

  const visibleLine = data.slice(
    Math.max(0, data.length - lineTickCount - clampedLineOffset),
    data.length - clampedLineOffset || undefined
  );

  const visibleCandles = allCandles.slice(
    Math.max(0, allCandles.length - visibleCandleCount - clampedCandleOffset),
    allCandles.length - clampedCandleOffset || undefined
  );

  // Compute price range
  let minP: number, maxP: number;
  if (type === "candle" && visibleCandles.length) {
    minP = Math.min(...visibleCandles.map((c) => c.l));
    maxP = Math.max(...visibleCandles.map((c) => c.h));
  } else if (visibleLine.length) {
    minP = Math.min(...visibleLine);
    maxP = Math.max(...visibleLine);
  } else {
    minP = 0; maxP = 1;
  }

  const allPrices = [minP, maxP, ...(entryPrice ? [entryPrice] : []), ...(liquidationPrice ? [liquidationPrice] : [])];
  const min = Math.min(...allPrices) * 0.997;
  const max = Math.max(...allPrices) * 1.003;
  const range = max - min || 1;

  const scaleY = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2);
  const scaleX = (i: number, total: number) =>
    padX + (i / Math.max(total - 1, 1)) * (chartW - padX * 2);

  const currentPrice = type === "candle"
    ? (visibleCandles[visibleCandles.length - 1]?.c ?? 0)
    : (visibleLine[visibleLine.length - 1] ?? 0);

  const firstPrice = type === "candle"
    ? (visibleCandles[0]?.o ?? currentPrice)
    : (visibleLine[0] ?? currentPrice);

  const up = currentPrice >= firstPrice;
  const color = up ? "#4ade80" : "#f87171";

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startOffset: clampedCandleOffset };
  }, [clampedCandleOffset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = dragRef.current.startX - e.clientX;
    const delta = Math.round(dx / 20);
    setCandleOffset(Math.min(Math.max(0, dragRef.current.startOffset + delta), maxCandleOffset));
  }, [maxCandleOffset]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startOffset: clampedCandleOffset };
      lastTouchRef.current = null;
    } else if (e.touches.length === 2) {
      dragRef.current = null;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchRef.current = { dist };
    }
  }, [clampedCandleOffset]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragRef.current) {
      const dx = dragRef.current.startX - e.touches[0].clientX;
      const delta = Math.round(dx / 15);
      setCandleOffset(Math.min(Math.max(0, dragRef.current.startOffset + delta), maxCandleOffset));
    } else if (e.touches.length === 2 && lastTouchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = lastTouchRef.current.dist / dist;
      setZoom((z) => Math.min(Math.max(0.3, z * scale), 4));
      lastTouchRef.current.dist = dist;
    }
  }, [maxCandleOffset]);

  const onTouchEnd = useCallback(() => {
    dragRef.current = null;
    lastTouchRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(0.3, z + e.deltaY * 0.001)));
  }, []);

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map((p) => (
    <line
      key={p}
      x1={padX} x2={chartW - padX}
      y1={padY + p * (height - padY * 2)}
      y2={padY + p * (height - padY * 2)}
      stroke="rgba(255,255,255,0.05)"
      strokeWidth={1}
      strokeDasharray="4 4"
    />
  ));

  // Price labels
  const priceLabels = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const price = max - p * range;
    const y = padY + p * (height - padY * 2);
    return (
      <text key={p} x={chartW + 6} y={y + 4} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">
        {price.toFixed(4)}
      </text>
    );
  });

  // Current price label
  const currentY = scaleY(currentPrice);
  const currentLabel = currentPrice > 0 ? (
    <g>
      <line x1={padX} x2={chartW - padX} y1={currentY} y2={currentY} stroke={color} strokeWidth={0.5} strokeDasharray="3 3" opacity={0.4} />
      <rect x={chartW} y={currentY - 9} width={labelW - 2} height={18} fill={color} rx={3} opacity={0.9} />
      <text x={chartW + labelW / 2 - 1} y={currentY + 4} fill="#000" fontSize={9} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {currentPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  // Entry price line
  const entryLine = entryPrice ? (
    <g>
      <line x1={padX} x2={chartW - padX} y1={scaleY(entryPrice)} y2={scaleY(entryPrice)} stroke="#facc15" strokeWidth={1} strokeDasharray="6 3" opacity={0.7} />
      <rect x={chartW} y={scaleY(entryPrice) - 9} width={labelW - 2} height={18} fill="#facc15" rx={3} opacity={0.85} />
      <text x={chartW + labelW / 2 - 1} y={scaleY(entryPrice) + 4} fill="#000" fontSize={9} fontFamily="monospace" textAnchor="middle">
        {entryPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  // Liquidation price line
  const liqLine = liquidationPrice ? (
    <g>
      <line x1={padX} x2={chartW - padX} y1={scaleY(liquidationPrice)} y2={scaleY(liquidationPrice)} stroke="#f87171" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
      <rect x={chartW} y={scaleY(liquidationPrice) - 9} width={labelW - 2} height={18} fill="#f87171" rx={3} opacity={0.85} />
      <text x={chartW + labelW / 2 - 1} y={scaleY(liquidationPrice) + 4} fill="#000" fontSize={9} fontFamily="monospace" textAnchor="middle">
        LIQ {liquidationPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  const svgProps = {
    ref: svgRef,
    viewBox: `0 0 ${w} ${height}`,
    width: "100%",
    height,
    preserveAspectRatio: "none" as const,
    style: { cursor: "grab", touchAction: "none" as const },
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  };

  // ── Candle chart ──
  if (type === "candle") {
    if (!visibleCandles.length) {
      return (
        <svg {...svgProps}>
          {gridLines}
          {priceLabels}
          <text x={chartW / 2} y={height / 2} fill="rgba(255,255,255,0.2)" fontSize={12} textAnchor="middle" fontFamily="monospace">
            Collecting candles...
          </text>
        </svg>
      );
    }

    const slotW = (chartW - padX * 2) / Math.max(visibleCandles.length, 1);
    const bodyW = Math.max(3, slotW * 0.6);

    return (
      <svg {...svgProps}>
        {gridLines}
        {priceLabels}
        {visibleCandles.map((c, i) => {
          const isUp = c.c >= c.o;
          const col = isUp ? "#4ade80" : "#f87171";
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
        {entryLine}
        {liqLine}
        {currentLabel}
      </svg>
    );
  }

  // ── Line chart ──
  if (!visibleLine.length) {
    return (
      <svg {...svgProps}>
        {gridLines}
        {priceLabels}
        <text x={chartW / 2} y={height / 2} fill="rgba(255,255,255,0.2)" fontSize={12} textAnchor="middle" fontFamily="monospace">
          Waiting for data...
        </text>
      </svg>
    );
  }

  const points = visibleLine.map((v, i) => `${scaleX(i, visibleLine.length)},${scaleY(v)}`).join(" ");
  const area = [
    `${scaleX(0, visibleLine.length)},${height}`,
    ...visibleLine.map((v, i) => `${scaleX(i, visibleLine.length)},${scaleY(v)}`),
    `${scaleX(visibleLine.length - 1, visibleLine.length)},${height}`,
  ].join(" ");

  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines}
      {priceLabels}
      <polygon points={area} fill="url(#areaGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={scaleX(visibleLine.length - 1, visibleLine.length)} cy={scaleY(currentPrice)} r={4} fill={color} />
      {entryLine}
      {liqLine}
      {currentLabel}
    </svg>
  );
    }
