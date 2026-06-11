import { useEffect, useState } from "react";

export type Market = "GAS" | "TXS_PER_BLOCK";

const KEEPER_API = "https://chainflux-production.up.railway.app";

export const MARKET_LABELS: Record<Market, string> = {
  GAS: "Gas Price",
  TXS_PER_BLOCK: "Transactions Per Block",
};

export const MARKET_UNITS: Record<Market, string> = {
  GAS: "gwei",
  TXS_PER_BLOCK: "txs",
};

type MetricState = "low" | "medium" | "high";

export function getMetricState(metric: string, value: number): MetricState {
  const thresholds: Record<string, [number, number]> = {
    GAS: [0.15, 0.4],
    TXS_PER_BLOCK: [150, 300],
    ACTIVE_ADDRESSES: [200, 600],
  };
  const t = thresholds[metric];
  if (!t) return "medium";
  const [low, high] = t;
  if (value <= low) return "low";
  if (value >= high) return "high";
  return "medium";
}

const MAX_TICKS = 7200;
const STORAGE_KEY = (m: Market) => `chainflux_history_${m}`;

function loadHistory(m: Market): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(m));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_TICKS);
  } catch {
    return [];
  }
}

function saveHistory(m: Market, history: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY(m), JSON.stringify(history.slice(-MAX_TICKS)));
  } catch {}
}

type PerpsState = {
  history: Record<Market, number[]>;
  prev24: Record<Market, number>;
};

const perpsState: PerpsState = {
  history: {
    GAS: loadHistory("GAS"),
    TXS_PER_BLOCK: loadHistory("TXS_PER_BLOCK"),
  },
  prev24: { GAS: 0, TXS_PER_BLOCK: 0 },
};

const perpsListeners = new Set<() => void>();
let perpsStarted = false;

async function fetchPrices() {
  try {
    const res = await fetch(KEEPER_API, { cache: "no-store" });
    const data = await res.json() as { GAS: number; TXS_PER_BLOCK: number; updatedAt: number };
    const markets: Market[] = ["GAS", "TXS_PER_BLOCK"];
    for (const m of markets) {
      const value = data[m] ?? 0;
      if (perpsState.history[m].length === 0) {
        perpsState.prev24[m] = value;
      } else if (perpsState.history[m].length >= 1080) {
        perpsState.prev24[m] = perpsState.history[m][0];
      }
      const next = [...perpsState.history[m].slice(-(MAX_TICKS - 1)), value];
      perpsState.history[m] = next;
      saveHistory(m, next);
    }
    perpsListeners.forEach((l) => l());
  } catch (err) {
    console.error("Perps fetch error:", err);
  }
}

function ensurePerpsTimer() {
  if (perpsStarted || typeof window === "undefined") return;
  perpsStarted = true;
  fetchPrices();
  setInterval(fetchPrices, 3000);
}

export function useMarket(m: Market) {
  const [, force] = useState(0);
  useEffect(() => {
    ensurePerpsTimer();
    const fn = () => force((x) => x + 1);
    perpsListeners.add(fn);
    return () => { perpsListeners.delete(fn); };
  }, []);
  const history = perpsState.history[m];
  const current = history[history.length - 1] ?? 0;
  const change = perpsState.prev24[m]
    ? ((current - perpsState.prev24[m]) / perpsState.prev24[m]) * 100
    : 0;
  return { history, current, change };
}

export function useAllMarkets() {
  const gas = useMarket("GAS");
  const txsPerBlock = useMarket("TXS_PER_BLOCK");
  return { GAS: gas, TXS_PER_BLOCK: txsPerBlock };
}

export function getCurrent(m: Market) {
  const h = perpsState.history[m];
  return h[h.length - 1] ?? 0;
}

export type FeedData = {
  GAS: number;
  GAS_DAILY_HIGH: number;
  GAS_DAILY_LOW: number;
  TXS_PER_BLOCK: number;
  TXS_DAILY_HIGH: number;
  TXS_DAILY_LOW: number;
  ACTIVE_ADDRESSES: number;
  ACTIVE_DAILY_HIGH: number;
  ACTIVE_DAILY_LOW: number;
  TVL_CHANGE: number;
  TVL_VALUE: number;
  NET_UTILIZATION: number;
  DEX_VOLUME: number;
  DEX_VOLUME_HIGH: number;
  DEX_VOLUME_LOW: number;
  STABLECOIN_FLOWS: number;
  STABLECOIN_HIGH: number;
  STABLECOIN_LOW: number;
  LIQUIDATIONS: number;
  LIQUIDATIONS_HIGH: number;
  LIQUIDATIONS_LOW: number;
  updatedAt: number;
};

const EMPTY_FEED: FeedData = {
  GAS: 0,
  GAS_DAILY_HIGH: 0,
  GAS_DAILY_LOW: 0,
  TXS_PER_BLOCK: 0,
  TXS_DAILY_HIGH: 0,
  TXS_DAILY_LOW: 0,
  ACTIVE_ADDRESSES: 0,
  ACTIVE_DAILY_HIGH: 0,
  ACTIVE_DAILY_LOW: 0,
  TVL_CHANGE: 0,
  TVL_VALUE: 0,
  NET_UTILIZATION: 0,
  DEX_VOLUME: 0,
  DEX_VOLUME_HIGH: 1,
  DEX_VOLUME_LOW: 0,
  STABLECOIN_FLOWS: 0,
  STABLECOIN_HIGH: 1,
  STABLECOIN_LOW: 0,
  LIQUIDATIONS: 0,
  LIQUIDATIONS_HIGH: 1,
  LIQUIDATIONS_LOW: 0,
  updatedAt: 0,
};

let feedState: FeedData = { ...EMPTY_FEED };
const feedListeners = new Set<() => void>();
let feedStarted = false;

async function fetchFeed() {
  try {
    const res = await fetch(`${KEEPER_API}/feed`, { cache: "no-store" });
    const data = await res.json() as FeedData;
    feedState = { ...EMPTY_FEED, ...data };
    feedListeners.forEach((l) => l());
  } catch (err) {
    console.error("Feed fetch error:", err);
  }
}

function ensureFeedTimer() {
  if (feedStarted || typeof window === "undefined") return;
  feedStarted = true;
  fetchFeed();
  setInterval(fetchFeed, 30000);
}

export function useNetworkFeed(): FeedData {
  const [, force] = useState(0);
  useEffect(() => {
    ensureFeedTimer();
    const fn = () => force((x) => x + 1);
    feedListeners.add(fn);
    return () => { feedListeners.delete(fn); };
  }, []);
  return { ...feedState };
  }
