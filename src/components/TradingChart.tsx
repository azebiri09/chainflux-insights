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
const DEFAULT_Y_ZOOM = 1.0;
const MIN_Y_ZOOM = 0.1;
const MAX_Y_ZOOM = 10.0;

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
  height = 500,
  entryPrice,
  liquidationPrice,
  direction,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [offset, setOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_CANDLES);
  const [yZoom, setYZoom] = useState(DEFAULT_Y_ZOOM);
  const [isLive, setIsLive] = useState(true);
  const [crosshair, setCrosshair] = useState<CrosshairData>(null);

  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const pinchRef = useRef<{
    dist: number;
    distX: number;
    distY: number;
    midX: number;
    visibleCount: number;
    yZoom: number;
    isHorizontal: boolean;
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);
  const isTouchDragging = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const w = 1200;
  const padY = 24;
  const padX = 4;
  const labelW = 68;
  const chartW = w - labelW;

  const ticksPerCandle = TICKS_PER_CANDLE[timeframe];
  const allCandles = type === "candle" ? toCandles(data, ticksPerCandle) : [];

  const maxOffset = Math.max(0, allCandles.length - MIN_VISIBLE);
  const clampedOffset = Math.min(Math.max(0, offset), maxOffset);
  const clampedVisible = Math.min(Math.max(MIN_VISIBLE, visibleCount), Math.min(MAX_VISIBLE, Math.max(1, allCandles.length)));

  const lineTickCount = clampedVisible * ticksPerCandle;
  const maxLineOffset = Math.max(0, data.length - lineTickCount);
  const clampedLineOffset = Math.min(clampedOffset * ticksPerCandle, maxLineOffset);

  const lineStart = Math.max(0, data.length - lineTickCount - clampedLineOffset);
  const lineEnd = data.length - clampedLineOffset || undefined;
  const visibleLine = data.slice(lineStart, lineEnd);

  const startIdx = Math.max(0, allCandles.length - clampedVisible - clampedOffset);
  const endIdx = allCandles.length - clampedOffset || undefined;
  const visibleCandles = allCandles.slice(startIdx, endIdx);

  let rawMin: number, rawMax: number;
  if (type === "candle" && visibleCandles.length) {
    rawMin = Math.min(...visibleCandles.map((c) => c.l));
    rawMax = Math.max(...visibleCandles.map((c) => c.h));
  } else if (visibleLine.length) {
    rawMin = Math.min(...visibleLine);
    rawMax = Math.max(...visibleLine);
  } else {
    rawMin = 0; rawMax = 1;
  }

  const allPrices = [
    rawMin, rawMax,
    ...(entryPrice ? [entryPrice] : []),
    ...(liquidationPrice ? [liquidationPrice] : []),
  ];
  const baseMin = Math.min(...allPrices);
  const baseMax = Math.max(...allPrices);
  const baseRange = baseMax - baseMin || 1;

  const mid = (baseMax + baseMin) / 2;
  const halfRange = (baseRange / 2) / yZoom;
  const paddedHalf = halfRange * 1.05;
  const min = mid - paddedHalf;
  const max = mid + paddedHalf;
  const range = max - min;

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

  useEffect(() => {
    setIsLive(clampedOffset === 0);
  }, [clampedOffset]);

  useEffect(() => {
    setOffset(0);
    setVisibleCount(DEFAULT_VISIBLE_CANDLES);
    setYZoom(DEFAULT_Y_ZOOM);
    setIsLive(true);
    setCrosshair(null);
  }, [timeframe]);

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
      const dx = e.clientX - dragRef.current.startX;
      const svg = svgRef.current;
      if (!svg) return;
      const pixelsPerCandle = svg.getBoundingClientRect().width / clampedVisible;
      const delta = Math.round(dx / pixelsPerCandle);
      const newOffset = Math.min(Math.max(0, dragRef.current.startOffset + delta), maxOffset);
      setOffset(newOffset);
    } else {
      const d = clientToChartData(e.clientX, e.clientY);
      setCrosshair(d);
    }
  }, [clampedOffset, clampedVisible, maxOffset, clientToChartData]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);
  const onMouseLeave = useCallback(() => { dragRef.current = null; setCrosshair(null); }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey) {
      const factor = e.deltaY > 0 ? 0.89 : 1.12;
      setYZoom((v) => Math.min(Math.max(MIN_Y_ZOOM, v * factor), MAX_Y_ZOOM));
    } else {
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      setVisibleCount((v) => Math.min(Math.max(MIN_VISIBLE, Math.round(v * factor)), MAX_VISIBLE));
    }
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

      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setOffset(0);
        setVisibleCount(DEFAULT_VISIBLE_CANDLES);
        setYZoom(DEFAULT_Y_ZOOM);
        setIsLive(true);
        setCrosshair(null);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      longPressTimer.current = setTimeout(() => {
        isTouchDragging.current = false;
        const d = clientToChartData(touch.clientX, touch.clientY);
        setCrosshair(d);
      }, 400);

    } else if (e.touches.length === 2) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      dragRef.current = null;
      setCrosshair(null);

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;

      // Lock axis at the moment fingers land — requires clear directional intent
      // Uses 1.5x threshold so ambiguous diagonals don't accidentally lock horizontal
      pinchRef.current = {
        dist,
        distX: Math.abs(dx),
        distY: Math.abs(dy),
        midX,
        visibleCount: clampedVisible,
        yZoom,
        isHorizontal: Math.abs(dx) > Math.abs(dy) * 1.5,
      };
    }
  }, [clampedOffset, clampedVisible, yZoom, clientToChartData]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && dragRef.current && touchStartPos.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;

      if (!isTouchDragging.current && Math.abs(dx) > 5) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        isTouchDragging.current = true;
        setCrosshair(null);
      }

      if (crosshair !== null && !isTouchDragging.current) {
        const d = clientToChartData(touch.clientX, touch.clientY);
        setCrosshair(d);
        return;
      }

      if (!isTouchDragging.current) return;

      const svg = svgRef.current;
      if (!svg) return;
      const pixelsPerCandle = svg.getBoundingClientRect().width / clampedVisible;
      const panDx = touch.clientX - dragRef.current.startX;
      const delta = Math.round(panDx / pixelsPerCandle);
      const newOffset = Math.min(Math.max(0, dragRef.current.startOffset + delta), maxOffset);
      setOffset(newOffset);

    } else if (e.touches.length === 2 && pinchRef.current) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Use axis locked at pinch start
      if (pinchRef.current.isHorizontal) {
        // Horizontal pinch → time axis zoom
        const scale = Math.max(absDx, 1) / Math.max(pinchRef.current.distX, 1);
        const newVisible = Math.min(
          Math.max(MIN_VISIBLE, Math.round(pinchRef.current.visibleCount * scale)),
          MAX_VISIBLE
        );
        setVisibleCount(newVisible);
      } else {
        // Vertical pinch → price axis zoom
        const scale = Math.max(absDy, 1) / Math.max(pinchRef.current.distY, 1);
        const newYZoom = Math.min(
          Math.max(MIN_Y_ZOOM, pinchRef.current.yZoom * scale),
          MAX_Y_ZOOM
        );
        setYZoom(newYZoom);
      }
    }
  }, [clampedVisible, maxOffset, crosshair, clientToChartData]);

  const onTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    dragRef.current = null;
    pinchRef.current = null;
    isTouchDragging.current = false;
    touchStartPos.current = null;
  }, []);

  const goLive = useCallback(() => {
    setOffset(0);
    setIsLive(true);
    setCrosshair(null);
  }, []);

  // ── Crosshair overlay ────────────────────────────────────────────
  const crosshairEl = crosshair ? (
    <g>
      <line x1={crosshair.x} x2={crosshair.x} y1={padY} y2={height - padY}
        stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={padX} x2={chartW - padX} y1={crosshair.y} y2={crosshair.y}
        stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={crosshair.x} cy={crosshair.y} r={5}
        fill="white" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
      <rect x={chartW} y={crosshair.y - 11} width={labelW - 2} height={22}
        fill="rgba(255,255,255,0.15)" rx={3} />
      <text x={chartW + labelW / 2 - 1} y={crosshair.y + 5}
        fill="white" fontSize={11} fontFamily="monospace" textAnchor="middle">
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
      { label: "Open",  value: c.o.toFixed(4), col: col },
      { label: "High",  value: c.h.toFixed(4), col: "rgba(255,255,255,0.9)" },
      { label: "Low",   value: c.l.toFixed(4), col: "rgba(255,255,255,0.9)" },
      { label: "Close", value: c.c.toFixed(4), col: col },
    ];
    const boxW = 160;
    const boxH = 104;
    const bx = crosshair.x + 14 > chartW - boxW ? crosshair.x - boxW - 8 : crosshair.x + 14;
    const by = Math.max(padY, Math.min(crosshair.y - boxH / 2, height - padY - boxH));
    return (
      <g>
        <rect x={bx} y={by} width={boxW} height={boxH} rx={7}
          fill="rgba(0,0,0,0.92)" stroke={col} strokeWidth={1.5} strokeOpacity={0.8} />
        {lines.map((line, i) => (
          <g key={i}>
            <text x={bx + 12} y={by + 22 + i * 22}
              fill="rgba(255,255,255,0.4)" fontSize={12} fontFamily="monospace">
              {line.label}
            </text>
            <text x={bx + boxW - 12} y={by + 22 + i * 22}
              fill={line.col} fontSize={13} fontFamily="monospace" textAnchor="end" fontWeight="600">
              {line.value}
            </text>
          </g>
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

  const liveButton = !isLive ? (
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
        {liveButton}
      </div>
    );
  }

  // ── Line chart ───────────────────────────────────────────────────
  if (visibleLine.length < 2) {
    return (
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg {...svgProps}>
          {gridLines}{priceLabels}
          <text x={chartW / 2} y={height / 2}
            fill="rgba(255,255,255,0.2)" fontSize={12} textAnchor="middle" fontFamily="monospace">
            {data.length === 0 ? "Waiting for data..." : "Loading..."}
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
        {crosshair && (
          <g>
            <rect
              x={crosshair.x + 10 > chartW - 90 ? crosshair.x - 95 : crosshair.x + 10}
              y={Math.max(padY, crosshair.y - 22)}
              width={85} height={28} rx={5}
              fill="rgba(0,0,0,0.88)" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            <text
              x={(crosshair.x + 10 > chartW - 90 ? crosshair.x - 95 : crosshair.x + 10) + 10}
              y={Math.max(padY, crosshair.y - 22) + 18}
              fill="white" fontSize={12} fontFamily="monospace" fontWeight="600">
              {crosshair.price.toFixed(4)}
            </text>
          </g>
        )}
      </svg>
      {liveButton}
    </div>
  );
}
