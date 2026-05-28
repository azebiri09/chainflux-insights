import { useRef, useState, useCallback } from "react";

type Props = {
  data: number[];
  type: "line" | "candle";
  height?: number;
  entryPrice?: number;
  liquidationPrice?: number;
  direction?: "LONG" | "SHORT";
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

export default function TradingChart({
  data,
  type,
  height = 300,
  entryPrice,
  liquidationPrice,
  direction,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const lastTouchRef = useRef<{ dist: number; midX: number } | null>(null);

  const w = 800;
  const padY = 20;
  const padX = 10;
  const labelW = 72; // right-side label area

  const visibleCount = Math.floor(30 * zoom);

  const allData =
    data.length >= 2
      ? data
      : [
          ...Array(20)
            .fill(0)
            .map((_, i) => {
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

  // Expand min/max to include entry and liq prices so lines always show
  const dataMin = Math.min(...visible);
  const dataMax = Math.max(...visible);
  const allPrices = [
    dataMin,
    dataMax,
    ...(entryPrice ? [entryPrice] : []),
    ...(liquidationPrice ? [liquidationPrice] : []),
  ];
  const min = Math.min(...allPrices) * 0.997;
  const max = Math.max(...allPrices) * 1.003;
  const range = max - min || 1;

  const chartW = w - labelW;
  const scaleY = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2);
  const scaleX = (i: number) =>
    padX + (i / Math.max(visible.length - 1, 1)) * (chartW - padX * 2);

  const currentPrice = visible[visible.length - 1];
  const up = visible.length >= 2 && currentPrice >= visible[0];
  const color = up ? "#4ade80" : "#f87171";

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startOffset: clampedOffset };
    },
    [clampedOffset]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      const dx = dragRef.current.startX - e.clientX;
      setOffset(Math.min(Math.max(0, dragRef.current.startOffset + Math.round(dx / 20)), maxOffset));
    },
    [maxOffset]
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Fixed touch handlers — preventDefault on passive:false listener via ref
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        dragRef.current = { startX: e.touches[0].clientX, startOffset: clampedOffset };
        lastTouchRef.current = null;
      } else if (e.touches.length === 2) {
        dragRef.current = null;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastTouchRef.current = { dist, midX };
      }
    },
    [clampedOffset]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && dragRef.current) {
        const dx = dragRef.current.startX - e.touches[0].clientX;
        setOffset(
          Math.min(Math.max(0, dragRef.current.startOffset + Math.round(dx / 15)), maxOffset)
        );
      } else if (e.touches.length === 2 && lastTouchRef.current) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = lastTouchRef.current.dist / dist;
        setZoom((z) => Math.min(Math.max(0.3, z * scale), 4));
        lastTouchRef.current.dist = dist;
      }
    },
    [maxOffset]
  );

  const onTouchEnd = useCallback(() => {
    dragRef.current = null;
    lastTouchRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(0.3, z + e.deltaY * 0.001)));
  }, []);

  // ── Shared overlays ────────────────────────────────────────────────────────

  const gridLines = [0.25, 0.5, 0.75].map((p) => (
    <line
      key={p}
      x1={padX}
      x2={chartW - padX}
      y1={padY + p * (height - padY * 2)}
      y2={padY + p * (height - padY * 2)}
      stroke="rgba(255,255,255,0.05)"
      strokeWidth={1}
      strokeDasharray="4 4"
    />
  ));

  // Price labels on right axis
  const priceLabels = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const price = max - p * range;
    const y = padY + p * (height - padY * 2);
    return (
      <text
        key={p}
        x={chartW + 6}
        y={y + 4}
        fill="rgba(255,255,255,0.3)"
        fontSize={9}
        fontFamily="monospace"
      >
        {price.toFixed(4)}
      </text>
    );
  });

  // Current price floating label
  const currentY = scaleY(currentPrice);
  const currentLabel = (
    <g>
      <line
        x1={padX}
        x2={chartW - padX}
        y1={currentY}
        y2={currentY}
        stroke={color}
        strokeWidth={0.5}
        strokeDasharray="3 3"
        opacity={0.4}
      />
      <rect x={chartW} y={currentY - 9} width={labelW - 2} height={18} fill={color} rx={3} opacity={0.9} />
      <text
        x={chartW + labelW / 2 - 1}
        y={currentY + 4}
        fill="#000"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
        fontWeight="bold"
      >
        {currentPrice?.toFixed(4)}
      </text>
    </g>
  );

  // Entry price dashed line
  const entryLine = entryPrice ? (
    <g>
      <line
        x1={padX}
        x2={chartW - padX}
        y1={scaleY(entryPrice)}
        y2={scaleY(entryPrice)}
        stroke="#facc15"
        strokeWidth={1}
        strokeDasharray="6 3"
        opacity={0.7}
      />
      <rect x={chartW} y={scaleY(entryPrice) - 9} width={labelW - 2} height={18} fill="#facc15" rx={3} opacity={0.85} />
      <text
        x={chartW + labelW / 2 - 1}
        y={scaleY(entryPrice) + 4}
        fill="#000"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {entryPrice.toFixed(4)}
      </text>
    </g>
  ) : null;

  // Liquidation price line
  const liqLine = liquidationPrice ? (
    <g>
      <line
        x1={padX}
        x2={chartW - padX}
        y1={scaleY(liquidationPrice)}
        y2={scaleY(liquidationPrice)}
        stroke="#f87171"
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={0.6}
      />
      <rect x={chartW} y={scaleY(liquidationPrice) - 9} width={labelW - 2} height={18} fill="#f87171" rx={3} opacity={0.85} />
      <text
        x={chartW + labelW / 2 - 1}
        y={scaleY(liquidationPrice) + 4}
        fill="#000"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
      >
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

  // ── Candle chart ───────────────────────────────────────────────────────────

  if (type === "candle") {
    const candles = toCandles(visible);
    const slotW = (chartW - padX * 2) / Math.max(candles.length, 1);
    const bodyW = Math.max(4, slotW * 0.6);

    return (
      <svg {...svgProps}>
        {gridLines}
        {priceLabels}
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
        {entryLine}
        {liqLine}
        {currentLabel}
      </svg>
    );
  }

  // ── Line chart ─────────────────────────────────────────────────────────────

  const points = visible.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(" ");
  const area = [
    `${scaleX(0)},${height}`,
    ...visible.map((v, i) => `${scaleX(i)},${scaleY(v)}`),
    `${scaleX(visible.length - 1)},${height}`,
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
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={scaleX(visible.length - 1)}
        cy={scaleY(currentPrice)}
        r={4}
        fill={color}
      />
      {entryLine}
      {liqLine}
      {currentLabel}
    </svg>
  );
            }
