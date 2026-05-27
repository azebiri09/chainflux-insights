import { useEffect, useState } from "react";
import { ethers } from "ethers";
import type { Market } from "./positions";

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";
const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

const ABI = [
  "function getMarket(uint8 m) external view returns (uint256 price, uint256 updatedAt, uint256 longOI, uint256 shortOI)"
];

const MARKET_INDEX: Record<Market, number> = {
  GAS: 0,
  ACTIVITY: 1,
  FLOW: 2
};

export const MARKET_UNITS: Record<Market, string> = {
  GAS: "gwei",
  ACTIVITY: "tx/s",
  FLOW: "ETH/min"
};

type State = {
  history: Record<Market, number[]>;
  prev24: Record<Market, number>;
};

const state: State = {
  history: { GAS: [], ACTIVITY: [], FLOW: [] },
  prev24: { GAS: 0, ACTIVITY: 0, FLOW: 0 },
};

const listeners = new Set<() => void>();
let started = false;

async function fetchPrices() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PROXY_ADDRESS, ABI, provider);

    const markets: Market[] = ["GAS", "ACTIVITY", "FLOW"];

    await Promise.all(
      markets.map(async (m) => {
        const result = await contract.getMarket(MARKET_INDEX[m]);
        const value = Number(result.price) / 1e18;
        if (state.history[m].length === 0) {
          state.prev24[m] = value;
        }
        // Store first value as 24h baseline once we have 8640 ticks (24h at 10s)
        if (state.history[m].length === 8640) {
          state.prev24[m] = state.history[m][0];
        }
        state.history[m] = [...state.history[m].slice(-99), value];
      })
    );

    listeners.forEach((l) => l());
  } catch (err) {
    console.error("Price fetch error:", err);
  }
}

function ensureTimer() {
  if (started || typeof window === "undefined") return;
  started = true;
  fetchPrices();
  setInterval(fetchPrices, 10000); // ✅ was 24000
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
  const activity = useMarket("ACTIVITY");
  const flow = useMarket("FLOW");
  return { GAS: gas, ACTIVITY: activity, FLOW: flow };
}

export function getCurrent(m: Market) {
  const h = state.history[m];
  return h[h.length - 1] ?? 0;
  }
