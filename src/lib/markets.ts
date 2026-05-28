import { useEffect, useState } from "react";
import type { Market } from "./positions";

const KEEPER_API = "https://chainflux-production.up.railway.app";

export const MARKET_LABELS: Record<Market, string> = {
  GAS: "GAS",
  AAVE_BORROWS: "AAVE BORROWS",
  TXS_PER_BLOCK: "TXS PER BLOCK",
};

export const MARKET_UNITS: Record<Market, string> = {
  GAS: "gwei",
  AAVE_BORROWS: "USD",
  TXS_PER_BLOCK: "txs",
};

type State = {
  history: Record<Market, number[]>;
  prev24: Record<Market, number>;
};

const state: State = {
  history: { GAS: [], AAVE_BORROWS: [], TXS_PER_BLOCK: [] },
  prev24: { GAS: 0, AAVE_BORROWS: 0, TXS_PER_BLOCK: 0 },
};

const listeners = new Set<() => void>();
let started = false;

async function fetchPrices() {
  try {
    const res = await fetch(KEEPER_API);
    const data = await res.json() as {
      GAS: number;
      AAVE_BORROWS: number;
      TXS_PER_BLOCK: number;
      updatedAt: number;
    };

    const markets: Market[] = ["GAS", "AAVE_BORROWS", "TXS_PER_BLOCK"];

    for (const m of markets) {
      const value = data[m] ?? 0;

      if (state.history[m].length === 0) {
        state.prev24[m] = value;
      } else if (state.history[m].length >= 30) {
        state.prev24[m] = state.history[m][0];
      }

      state.history[m] = [...state.history[m].slice(-99), value];
    }

    listeners.forEach((l) => l());
  } catch (err) {
    console.error("Price fetch error:", err);
  }
}

function ensureTimer() {
  if (started || typeof window === "undefined") return;
  started = true;
  fetchPrices();
  setInterval(fetchPrices, 10000);
}

export function useMarket(m: Market) {
  const [, force] = useState(0);
  useEffect(() => {
    ensureTimer();
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  const history = state.history[m];
  const current = history[history.length - 1] ?? 0;
  const change = state.prev24[m]
    ? ((current - state.prev24[m]) / state.prev24[m]) * 100
    : 0;
  return { history, current, change };
}

export function useAllMarkets() {
  const gas = useMarket("GAS");
  const aaveBorrows = useMarket("AAVE_BORROWS");
  const txsPerBlock = useMarket("TXS_PER_BLOCK");
  return { GAS: gas, AAVE_BORROWS: aaveBorrows, TXS_PER_BLOCK: txsPerBlock };
}

export function getCurrent(m: Market) {
  const h = state.history[m];
  return h[h.length - 1] ?? 0;
      }
