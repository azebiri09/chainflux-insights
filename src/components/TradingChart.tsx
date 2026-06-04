import { useRef, useState, useCallback, useEffect } from "react";

type Candle = { o: number; h: number; l: number; c: number };

type CrosshairData = {
  x: number;
  y: number;
  price: number;
  candle?: Candle;
  index: number;
} | null;

type Props = {
  data: number[];
  timeframe: "30s" | "1m" | "5m";
  type: "line" | "candle";
  height?: number;
  entryPrice?: number;
  liquidationPrice?: number;
  direction?: "LONG" | "SHORT";
};

const TICKS_PER_CANDLE: Record<string, number> = {
  "30s": 10,
  "1m": 20,
  "5m": 100,
};

const DEFAULT_VISIBLE_CANDLES = 40;
const MIN_VISIBLE = 6;
const MAX_VISIBLE = 120;

function toCandles(data: number[], ticksPerCandle: number): Candle[] {
  const out: Candle[] = [];
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
  const containerRef = useRef<HTMLDivElement>(null);

  // offset: how many candles from the right end we've panned (0 = live)
  const [offset, setOffset] = useState(0);
  // visibleCount: how many candles fit on screen (zoom)
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_CANDLES);
  const [isLive, setIsLive] = useState(true);
  const [crosshair, setCrosshair] = useState<CrosshairData>(null);

  // Gesture refs — never trigger re-renders
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const pinchRef = useRef<{ dist: number; midX: number; visibleCount: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);
  const isTouchDragging = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // SVG coordinate space
  const w = 800;
  const padY = 24;
  const padX = 8;
  const labelW = 68;
  const chartW = w - labelW;

  const ticksPerCandle = TICKS_PER_CANDLE[timeframe];
  const allCandles = type === "candle" ? toCandles(data, ticksPerCandle) : [];

  // Clamp offset and visibleCount
  const maxOffset = Math.max(0, allCandles.length - MIN_VISIBLE);
  const clampedOffset = Math.min(Math.max(0, offset), maxOffset);
  const clampedVisible = Math.min(Math.max(MIN_VISIBLE, visibleCount), Math.min(MAX_VISIBLE, allCandles.length));

  // For line mode, derive equivalent
  const lineTickCount = clampedVisible * ticksPerCandle;
  const maxLineOffset = Math.max(0, data.length - lineTickCount);
  const clampedLineOffset = Math.min(clampedOffset * ticksPerCandle, maxLineOffset);

  const visibleLine = data.slice(
    Math.max(0, data.length - lineTickCount - clampedLineOffset),
    data.length - clampedLineOffset || undefined
  );

  const startIdx = Math.max(0, allCandles.length - clampedVisible - clampedOffset);
  const endIdx = allCandles.length - clampedOffset || undefined;
  const visibleCandles = allCandles.slice(startIdx, endIdx);

  // Price range
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

  // Auto-follow live: when offset is 0, we're live
  useEffect(() => {
    setIsLive(clampedOffset === 0);
  }, [clampedOffset]);

  // Reset on timeframe change
  useEffect(() => {
    setOffset(0);
    setVisibleCount(DEFAULT_VISIBLE_CANDLES);
    setIsLive(true);
    setCrosshair(null);
  }, [timeframe]);

  // Convert SVG clientX to candle index and price
  const clientToChartData = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * w;
    const svgY = ((clientY - rect.top) / rect.height) * height;

    if (type === "candle" && visibleCandles.length) {
      const slotW = (chartW - padX * 2) / Math.max(visibleCandles.length, 1);
      const idx = Math.round((svgX - padX) / slotW - 0.5);
      const clamped = Math.min(Math.max(0, idx), visibleCandles.length - 1);
      const candle = visibleCandles[clamped];
      const cx = padX + clamped * slotW + slotW / 2;
      const price = min + (1 - (svgY - padY) / (height - padY * 2)) * range;
      return { x: cx, y: scaleY(candle.c), price: candle.c, candle, index: clamped };
    } else if (visibleLine.length) {
      const idx = Math.round(((svgX - padX) / (chartW - padX * 2)) * (visibleLine.length - 1));
      const clamped = Math.min(Math.max(0, idx), visibleLine.length - 1);
      const price = visibleLine[clamped];
      return { x: scaleX(clamped, visibleLine.length), y: scaleY(price), price, index: clamped };
    }
    return null;
  }, [visibleCandles, visibleLine, min, range, height, type]);

  // ── Mouse handlers ──────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startOffset: clampedOffset };
  }, [clampedOffset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = dragRef.current.startX - e.clientX;
      const svg = svgRef.current;
      if (!svg) return;
      const pixelsPerCandle = svg.getBoundingClientRect().width / clampedVisible;
      const delta = Math.round(dx / pixelsPerCandle);
      const newOffset = Math.min(Math.max(0, dragRef.current.startOffset + delta), maxOffset);
      setOffset(newOffset);
    } else {
      // Hover crosshair
      const d = clientToChartData(e.clientX, e.clientY);
      setCrosshair(d);
    }
  }, [clampedOffset, clampedVisible, maxOffset, clientToChartData]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);
  const onMouseLeave = useCallback(() => { dragRef.current = null; setCrosshair(null); }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    setVisibleCount((v) => Math.min(Math.max(MIN_VISIBLE, Math.round(v * factor)), MAX_VISIBLE));
  }, []);

  // ── Touch handlers ───────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      isTouchDragging.current = false;
      dragRef.current = { startX: touch.clientX, startOffset: clampedOffset };
      pinchRef.current = null;

      // Double-tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap → reset
        setOffset(0);
        setVisibleCount(DEFAULT_VISIBLE_CANDLES);
        setIsLive(true);
        setCrosshair(null);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      // Long press → crosshair
      longPressTimer.current = setTimeout(() => {
        isTouchDragging.current = false; // freeze pan
        const d = clientToChartData(touch.clientX, touch.clientY);
        setCrosshair(d);
      }, 400);

    } else if (e.touches.length === 2) {
      // Cancel single-touch mode
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      dragRef.current = null;
      setCrosshair(null);

      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      pinchRef.current = { dist, midX, visibleCount: clampedVisible };
    }
  }, [clampedOffset, clampedVisible, clientToChartData]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && dragRef.current && touchStartPos.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;

      // Determine intent on first significant move
      if (!isTouchDragging.current && Math.abs(dx) > 5) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        isTouchDragging.current = true;
        setCrosshair(null);
      }

      // If crosshair is active (long press), update crosshair position
      if (crosshair !== null && !isTouchDragging.current) {
        const d = clientToChartData(touch.clientX, touch.clientY);
        setCrosshair(d);
        return;
      }

      if (!isTouchDragging.current) return;

      // Pan
      const svg = svgRef.current;
      if (!svg) return;
      const pixelsPerCandle = svg.getBoundingClientRect().width / clampedVisible;
      const panDx = dragRef.current.startX - touch.clientX;
      const delta = Math.round(panDx / pixelsPerCandle);
      const newOffset = Math.min(Math.max(0, dragRef.current.startOffset + delta), maxOffset);
      setOffset(newOffset);

    } else if (e.touches.length === 2 && pinchRef.current) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);

      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = pinchRef.current.dist / dist;
      const newVisible = Math.min(Math.max(MIN_VISIBLE, Math.round(pinchRef.current.visibleCount * scale)), MAX_VISIBLE);
      setVisibleCount(newVisible);
    }
  }, [clampedVisible, maxOffset, crosshair, clientToChartData]);

  const onTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    dragRef.current = null;
    pinchRef.current = null;
    isTouchDragging.current = false;
    touchStartPos.current = null;
    // Don't clear crosshair here — let it persist until next tap
  }, []);

  const goLive = useCallback(() => {
    setOffset(0);
    setIsLive(true);
    setCrosshair(null);
  }, []);

  // ── Crosshair overlay ────────────────────────────────────────────
  const crosshairEl = crosshair ? (
    <g>
      {/* Vertical line */}
      <line x1={crosshair.x} x2={crosshair.x} y1={padY} y2={height - padY}
        stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3 3" />
      {/* Horizontal line */}
      <line x1={padX} x2={chartW - padX} y1={crosshair.y} y2={crosshair.y}
        stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3 3" />
      {/* Dot */}
      <circle cx={crosshair.x} cy={crosshair.y} r={4}
        fill="white" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
      {/* Price badge on Y axis */}
      <rect x={chartW} y={crosshair.y - 9} width={labelW - 2} height={18}
        fill="rgba(255,255,255,0.15)" rx={3} />
      <text x={chartW + labelW / 2 - 1} y={crosshair.y + 4}
        fill="white" fontSize={9} fontFamily="monospace" textAnchor="middle">
        {crosshair.price.toFixed(4)}
      </text>
    </g>
  ) : null;

  // ── Candle tooltip box ───────────────────────────────────────────
  const tooltipEl = crosshair?.candle ? (() => {
    const c = crosshair.candle!;
    const isUp = c.c >= c.o;
    const col = isUp ? "#4ade80" : "#f87171";
    const lines = [
      `O ${c.o.toFixed(4)}`,
      `H ${c.h.toFixed(4)}`,
      `L ${c.l.toFixed(4)}`,
      `C ${c.c.toFixed(4)}`,
    ];
    const bx = crosshair.x + 10 > chartW - 120 ? crosshair.x - 105 : crosshair.x + 10;
    const by = Math.max(padY, crosshair.y - 50);
    return (
      <g>
        <rect x={bx} y={by} width={95} height={72} rx={5}
          fill="rgba(0,0,0,0.85)" stroke={col} strokeWidth={1} strokeOpacity={0.6} />
        {lines.map((line, i) => (
          <text key={i} x={bx + 8} y={by + 16 + i * 14}
            fill={i === 0 || i === 3 ? col : "rgba(255,255,255,0.7)"}
            fontSize={9} fontFamily="monospace">
            {line}
          </text>
        ))}
      </g>
    );
  })() : null;

  // ── Shared SVG props ─────────────────────────────────────────────
  const svgProps = {
    ref: svgRef,
    viewBox: `0 0 ${w} ${height}`,
    width: "100%",
    height,
    preserveAspectRatio: "none" as const,
    style: { cursor: dragRef.current ? "grabbing" : "crosshair", touchAction: "none" as const, display: "block" },
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  };

  // ── Grid & labels ────────────────────────────────────────────────
  const gridLines = [0.25, 0.5, 0.75].map((p) => (
    <line key={p}
      x1={padX} x2={chartW - padX}
      y1={padY + p * (height - padY * 2)}
      y2={padY + p * (height - padY * 2)}
      stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="4 4" />
  ));

  const priceLabels = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const price = max - p * range;
    const y = padY + p * (height - padY * 2);
    return (
      <text key={p} x={chartW + 6} y={y + 4}
        fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">
        {price.toFixed(4)}
      </text>
    );
  });

  const currentY = scaleY(currentPrice);
  const currentLabel = currentPrice > 0 ? (
    <g>
      <line x1={padX} x2={chartW - padX} y1={currentY} y2={currentY}
        stroke={color} strokeWidth={0.5} strokeDasharray="3 3" opacity={0.4} />
      <rect x={chartW} y={currentY - 9} width={labelW - 2} height={18} fill={color} rx={3} opacity={0.9} />
      <text x={chartW + labelW / 2 - 1} y={currentY + 4}
        fill="#000" fontSize={9} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {currentPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  const entryLine = entryPrice ? (
    <g>
      <line x1={padX} x2={chartW - padX} y1={scaleY(entryPrice)} y2={scaleY(entryPrice)}
        stroke="#facc15" strokeWidth={1} strokeDasharray="6 3" opacity={0.7} />
      <rect x={chartW} y={scaleY(entryPrice) - 9} width={labelW - 2} height={18} fill="#facc15" rx={3} opacity={0.85} />
      <text x={chartW + labelW / 2 - 1} y={scaleY(entryPrice) + 4}
        fill="#000" fontSize={9} fontFamily="monospace" textAnchor="middle">
        {entryPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  const liqLine = liquidationPrice ? (
    <g>
      <line x1={padX} x2={chartW - padX} y1={scaleY(liquidationPrice)} y2={scaleY(liquidationPrice)}
        stroke="#f87171" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
      <rect x={chartW} y={scaleY(liquidationPrice) - 9} width={labelW - 2} height={18} fill="#f87171" rx={3} opacity={0.85} />
      <text x={chartW + labelW / 2 - 1} y={scaleY(liquidationPrice) + 4}
        fill="#000" fontSize={9} fontFamily="monospace" textAnchor="middle">
        LIQ {liquidationPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  // ── Candle chart ─────────────────────────────────────────────────
  if (type === "candle") {
    if (!visibleCandles.length) {
      return (
        <div ref={containerRef} style={{ position: "relative" }}>
          <svg {...svgProps}>
            {gridLines}{priceLabels}
            <text x={chartW / 2} y={height / 2}
              fill="rgba(255,255,255,0.2)" fontSize={12} textAnchor="middle" fontFamily="monospace">
              Collecting candles...
            </text>
          </svg>
        </div>
      );
    }

    const slotW = (chartW - padX * 2) / Math.max(visibleCandles.length, 1);
    const bodyW = Math.max(2, Math.min(slotW * 0.65, 20));

    return (
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg {...svgProps}>
          {gridLines}{priceLabels}
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
                <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bH} fill={col} rx={1.5} opacity={0.9} />
              </g>
            );
          })}
          {entryLine}{liqLine}{currentLabel}
          {crosshairEl}{tooltipEl}
        </svg>

        {/* Live button */}
        {!isLive && (
          <button
            onClick={goLive}
            style={{
              position: "absolute",
              bottom: 10,
              right: 76,
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.5)",
              borderRadius: 5,
              color: "#4ade80",
              fontSize: 11,
              fontFamily: "monospace",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              letterSpacing: "0.05em",
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              animation: "pulse 1.5s infinite",
              display: "inline-block",
              flexShrink: 0,
            }} />
            LIVE
          </button>
        )}
      </div>
    );
  }

  // ── Line chart ───────────────────────────────────────────────────
  if (!visibleLine.length) {
    return (
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg {...svgProps}>
          {gridLines}{priceLabels}
          <text x={chartW / 2} y={height / 2}
            fill="rgba(255,255,255,0.2)" fontSize={12} textAnchor="middle" fontFamily="monospace">
            Waiting for data...
          </text>
        </svg>
      </div>
    );
  }

  const points = visibleLine.map((v, i) => `${scaleX(i, visibleLine.length)},${scaleY(v)}`).join(" ");
  const area = [
    `${scaleX(0, visibleLine.length)},${height}`,
    ...visibleLine.map((v, i) => `${scaleX(i, visibleLine.length)},${scaleY(v)}`),
    `${scaleX(visibleLine.length - 1, visibleLine.length)},${height}`,
  ].join(" ");

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg {...svgProps}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines}{priceLabels}
        <polygon points={area} fill="url(#areaGrad)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />
        <circle
          cx={scaleX(visibleLine.length - 1, visibleLine.length)}
          cy={scaleY(currentPrice)}
          r={4} fill={color} />
        {entryLine}{liqLine}{currentLabel}
        {crosshairEl}
        {/* Line mode tooltip */}
        {crosshair && (
          <g>
            <rect
              x={crosshair.x + 10 > chartW - 90 ? crosshair.x - 85 : crosshair.x + 10}
              y={Math.max(padY, crosshair.y - 20)}
              width={75} height={24} rx={4}
              fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <text
              x={(crosshair.x + 10 > chartW - 90 ? crosshair.x - 85 : crosshair.x + 10) + 8}
              y={Math.max(padY, crosshair.y - 20) + 15}
              fill="white" fontSize={9} fontFamily="monospace">
              {crosshair.price.toFixed(4)}
            </text>
          </g>
        )}
      </svg>

      {/* Live button */}
      {!isLive && (
        <button
          onClick={goLive}
          style={{
            position: "absolute",
            bottom: 10,
            right: 76,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            background: "rgba(74,222,128,0.15)",
            border: "1px solid rgba(74,222,128,0.5)",
            borderRadius: 5,
            color: "#4ade80",
            fontSize: 11,
            fontFamily: "monospace",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            letterSpacing: "0.05em",
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#4ade80",
            boxShadow: "0 0 6px #4ade80",
            animation: "pulse 1.5s infinite",
            display: "inline-block",
            flexShrink: 0,
          }} />
          LIVE
        </button>
      )}
    </div>
  );
            }
