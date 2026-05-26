import { useEffect, useRef, useState } from "react";
import type { Market } from "./positions";

const BASE: Record<Market, number> = { GAS: 24.5, ACTIVITY: 1320, FLOW: 875 };
const VOL: Record<Market, number> = { GAS: 0.8, ACTIVITY: 35, FLOW: 22 };

// Shared global state so prices stay consistent across components
type State = { history: Record<Market, number[]>; prev24: Record<Market, number> };
const state: State = {
  history: { GAS: seed("GAS"), ACTIVITY: seed("ACTIVITY"), FLOW: seed("FLOW") },
  prev24: { GAS: BASE.GAS, ACTIVITY: BASE.ACTIVITY, FLOW: BASE.FLOW },
};
function seed(m: Market) {
  const arr: number[] = [];
  let v = BASE[m];
  for (let i = 0; i < 20; i++) {
    v += (Math.random() - 0.5) * VOL[m];
    arr.push(Math.max(0.1, v));
  }
  return arr;
}
const listeners = new Set<() => void>();
let started = false;
function tick() {
  (Object.keys(BASE) as Market[]).forEach((m) => {
    const last = state.history[m][state.history[m].length - 1];
    const next = Math.max(0.1, last + (Math.random() - 0.5) * VOL[m]);
    state.history[m] = [...state.history[m].slice(-19), next];
  });
  listeners.forEach((l) => l());
}
function ensureTimer() {
  if (started || typeof window === "undefined") return;
  started = true;
  setInterval(tick, 2400);
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
  const current = history[history.length - 1];
  const change = ((current - state.prev24[m]) / state.prev24[m]) * 100;
  return { history, current, change };
}

export function useAllMarkets() {
  const gas = useMarket("GAS");
  const activity = useMarket("ACTIVITY");
  const flow = useMarket("FLOW");
  return { GAS: gas, ACTIVITY: activity, FLOW: flow };
}

export function getCurrent(m: Market) {
  const h = state.history[m];
  return h[h.length - 1];
}

export const MARKET_UNITS: Record<Market, string> = { GAS: "gwei", ACTIVITY: "tx/s", FLOW: "ETH/min" };
