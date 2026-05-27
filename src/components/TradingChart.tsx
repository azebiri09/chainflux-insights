import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
} from "lightweight-charts";

type Props = {
  data: number[];
  type: "line" | "candle";
  height?: number;
};

function toCandles(data: number[]): CandlestickData[] {
  const out: CandlestickData[] = [];
  const groupSize = 5;
  const now = Math.floor(Date.now() / 1000);
  const interval = 10;

  for (let i = 0; i < data.length; i += groupSize) {
    const group = data.slice(i, i + groupSize);
    if (group.length < 2) continue;
    const o = group[0];
    const c = group[group.length - 1];
    const h = Math.max(...group);
    const l = Math.min(...group);
    const time = (now - (data.length - i) * interval) as any;
    out.push({ time, open: o, high: h, low: l, close: c });
  }
  return out;
}

function toLine(data: number[]): LineData[] {
  const now = Math.floor(Date.now() / 1000);
  const interval = 10;
  return data.map((v, i) => ({
    time: (now - (data.length - i) * interval) as any,
    value: v,
  }));
}

export default function TradingChart({ data, type, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.4)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.4)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.4)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
      width: containerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    if (type === "candle") {
      const series = chart.addCandlestickSeries({
        upColor: "oklch(0.78 0.16 155)",
        downColor: "oklch(0.70 0.20 25)",
        borderUpColor: "oklch(0.78 0.16 155)",
        borderDownColor: "oklch(0.70 0.20 25)",
        wickUpColor: "oklch(0.78 0.16 155)",
        wickDownColor: "oklch(0.70 0.20 25)",
      });
      const candles = toCandles(data);
      if (candles.length) series.setData(candles);
      seriesRef.current = series;
    } else {
      const up = data.length < 2 || data[data.length - 1] >= data[0];
      const color = up ? "#4ade80" : "#f87171";
      const series = chart.addAreaSeries({
        lineColor: color,
        topColor: color.replace(")", ", 0.15)").replace("rgb", "rgba"),
        bottomColor: "transparent",
        lineWidth: 2,
      });
      const lineData = toLine(data);
      if (lineData.length) series.setData(lineData);
      seriesRef.current = series;
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [type, height]);

  // Update data without recreating chart
  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    if (type === "candle") {
      const candles = toCandles(data);
      if (candles.length) seriesRef.current.setData(candles);
    } else {
      const lineData = toLine(data);
      if (lineData.length) seriesRef.current.setData(lineData);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, type]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
  }
