import { useEffect, useState } from "react";

export type Market = "GAS" | "TXS_PER_BLOCK";

export type FeedMetric =
  | "ACTIVE_ADDRESSES"
  | "WHALE_TRANSFERS"
  | "ETH_INTO_AAVE"
  | "LIQUIDATION_VOLUME"
  | "STABLES_MINTED_BURNED"
  | "NEW_WALLET_CREATION"
  | "BRIDGE_INFLOWS_OUTFLOWS"
  | "DEX_VOLUME";

const KEEPER_API = "https://chainflux-production.up.railway.app";

export const MARKET_LABELS: Record<Market, string> = {
  GAS: "GAS",
  TXS_PER_BLOCK: "TXS PER BLOCK",
};

export const MARKET_UNITS: Record<Market, string> = {
  GAS: "gwei",
  TXS_PER_BLOCK: "txs",
};

export const FEED_LABELS: Record<FeedMetric, string> = {
  ACTIVE_ADDRESSES: "Active Addresses",
  WHALE_TRANSFERS: "Whale Transfers",
  ETH_INTO_AAVE: "ETH into Aave",
  LIQUIDATION_VOLUME: "Liquidation Volume",
  STABLES_MINTED_BURNED: "Stables Minted / Burned",
  NEW_WALLET_CREATION: "New Wallet Creation",
  BRIDGE_INFLOWS_OUTFLOWS: "Bridge Inflows / Outflows",
  DEX_VOLUME: "DEX Volume",
};

export const FEED_UNITS: Record<FeedMetric, string> = {
  ACTIVE_ADDRESSES: "addresses",
  WHALE_TRANSFERS: "txs",
  ETH_INTO_AAVE: "ETH",
  LIQUIDATION_VOLUME: "events",
  STABLES_MINTED_BURNED: "USDC",
  NEW_WALLET_CREATION: "wallets",
  BRIDGE_INFLOWS_OUTFLOWS: "ETH",
  DEX_VOLUME: "swaps",
};

type MetricState = "low" | "medium" | "high";

type Explanation = {
  happening: string;
  why: string;
  means: string;
  action: string;
};

export const FEED_EXPLANATIONS: Record<FeedMetric, Record<MetricState, Explanation>> = {
  ACTIVE_ADDRESSES: {
    low: {
      happening: "Very few unique addresses are active in the current block.",
      why: "Network participation is suppressed. Traders and users are sitting on the sidelines.",
      means: "The chain is in a quiet phase. Low activity often precedes a sharp move in either direction.",
      action: "Watch for a surge. When addresses spike after a quiet period, momentum follows fast.",
    },
    medium: {
      happening: "A moderate number of unique addresses are transacting right now.",
      why: "Steady participation across the network. No extreme activity but the chain is alive.",
      means: "Normal operating conditions. Markets are liquid and positions can be entered cleanly.",
      action: "No urgency. Monitor for a breakout above current levels before committing size.",
    },
    high: {
      happening: "Unusually high number of unique addresses active in this block.",
      why: "A wave of users and bots hit the chain simultaneously. This level of participation is rare.",
      means: "Network is in high demand. Gas will follow. Something is moving the market.",
      action: "Act now or wait for the dust to settle. High address activity rarely stays quiet for long.",
    },
  },
  WHALE_TRANSFERS: {
    low: {
      happening: "No large ETH transfers detected in the current block.",
      why: "Whales are holding position. No major capital is moving on-chain right now.",
      means: "Institutional players are quiet. The market is driven by retail activity only.",
      action: "Low whale activity means lower volatility. Good time for precise entries.",
    },
    medium: {
      happening: "A handful of large ETH transfers are moving through the network.",
      why: "Some whales are repositioning. The transfers are notable but not alarming.",
      means: "Smart money is active. Watch the direction of these transfers for clues.",
      action: "Stay alert. Mid-level whale activity often escalates before a bigger move.",
    },
    high: {
      happening: "Multiple whale-sized ETH transfers detected in this block.",
      why: "Large holders are moving capital aggressively. This is not normal retail behavior.",
      means: "Something is happening at the institutional level. Liquidity is shifting.",
      action: "This is your signal. Whale activity at this level precedes major price action.",
    },
  },
  ETH_INTO_AAVE: {
    low: {
      happening: "Minimal ETH is flowing into Aave right now.",
      why: "Lenders are not actively depositing. Confidence in yield is low or capital is deployed elsewhere.",
      means: "Aave liquidity is thin. Borrowing costs may rise if demand picks up suddenly.",
      action: "Watch for a sudden inflow spike as a signal that leveraged positions are being built.",
    },
    medium: {
      happening: "A steady flow of ETH is entering Aave lending pools.",
      why: "Lenders are comfortable with current yields. Capital is being put to work.",
      means: "Healthy lending conditions. Leverage is available and being used moderately.",
      action: "Normal market. No action required unless you are monitoring yield-seeking behavior.",
    },
    high: {
      happening: "A large amount of ETH is flooding into Aave right now.",
      why: "Whales and institutions are rushing to deposit. They expect to borrow against this soon.",
      means: "Leveraged positions are being prepared. A big move is likely being financed on-chain.",
      action: "Pay attention. ETH rushing into Aave at this scale means someone is about to make a large bet.",
    },
  },
  LIQUIDATION_VOLUME: {
    low: {
      happening: "No liquidations detected on Aave in the current block.",
      why: "Collateral levels are healthy across borrowers. No positions are underwater.",
      means: "The market is stable. No forced selling is adding pressure to prices.",
      action: "Clean conditions for opening positions. No liquidation cascade risk right now.",
    },
    medium: {
      happening: "A small number of Aave liquidations are occurring.",
      why: "Some borrowers got caught offside. Prices moved enough to trigger margin calls.",
      means: "Pockets of stress in the lending market. Could be isolated or the start of something larger.",
      action: "Monitor closely. A few liquidations can snowball into a cascade if prices keep moving.",
    },
    high: {
      happening: "Heavy liquidation activity is hitting Aave right now.",
      why: "Prices moved sharply and over-leveraged borrowers are being wiped out en masse.",
      means: "A liquidation cascade is in progress. Forced selling is accelerating the move.",
      action: "Extreme caution. Cascades are volatile and fast. Direction traders can ride this but size down.",
    },
  },
  STABLES_MINTED_BURNED: {
    low: {
      happening: "Very little USDC is being minted or burned right now.",
      why: "Stablecoin demand is flat. No large capital entries or exits from crypto markets.",
      means: "Sideways conditions. No major fiat inflow or outflow is happening on-chain.",
      action: "Wait for a spike in either direction. Stable minting means fresh capital is entering.",
    },
    medium: {
      happening: "Moderate USDC minting and burning activity is occurring.",
      why: "Normal capital movement in and out of the stablecoin ecosystem.",
      means: "The market is functioning normally. No extraordinary pressure in either direction.",
      action: "Use this as a baseline. Any deviation from this level is worth noting.",
    },
    high: {
      happening: "Massive USDC minting or burning is happening right now.",
      why: "A large institution or protocol is moving serious capital through the stablecoin layer.",
      means: "Either fresh money is entering crypto or someone is cashing out at scale.",
      action: "This is a macro signal. Large stablecoin flows precede significant market moves.",
    },
  },
  NEW_WALLET_CREATION: {
    low: {
      happening: "Almost no new wallets are being created in this block.",
      why: "Onboarding activity is low. No new users or contracts are being deployed right now.",
      means: "The network is not attracting new participants at this moment.",
      action: "Low wallet creation is normal during quiet periods. Watch for spikes during news events.",
    },
    medium: {
      happening: "A normal number of new wallets and contracts are being created.",
      why: "Steady onboarding of new users and deployment of smart contracts.",
      means: "Healthy growth signal. The ecosystem is expanding at a sustainable rate.",
      action: "No immediate action. Use as context for broader network health.",
    },
    high: {
      happening: "Unusually high number of new wallets being created right now.",
      why: "A bot wave, airdrop farming, or viral event is driving mass wallet creation.",
      means: "Something is attracting a flood of new participants. Network activity will spike.",
      action: "Find out what is driving this. New wallet surges often precede gas spikes and volume explosions.",
    },
  },
  BRIDGE_INFLOWS_OUTFLOWS: {
    low: {
      happening: "Very little ETH is moving through the Arbitrum bridge right now.",
      why: "Cross-chain capital flow is quiet. Users are not actively bridging in or out.",
      means: "Arbitrum liquidity is stable. No major inflow or outflow pressure on the network.",
      action: "Low bridge activity means the current liquidity pool is all that is available. Watch for changes.",
    },
    medium: {
      happening: "Moderate ETH is flowing through the Arbitrum bridge.",
      why: "Normal cross-chain activity. Users are moving capital between Ethereum and Arbitrum.",
      means: "Healthy liquidity flow. The bridge is being used as intended.",
      action: "Normal conditions. No extraordinary action needed.",
    },
    high: {
      happening: "Large amounts of ETH are crossing the Arbitrum bridge right now.",
      why: "Capital is flooding in or out of Arbitrum at an unusually high rate.",
      means: "A major liquidity event is happening. Either Arbitrum is attracting capital or losing it fast.",
      action: "This is a directional signal. Large bridge inflows are bullish for Arbitrum activity. Outflows are bearish.",
    },
  },
  DEX_VOLUME: {
    low: {
      happening: "Very few swaps are happening on Uniswap V3 right now.",
      why: "Trading activity on decentralized exchanges is suppressed. Liquidity is idle.",
      means: "The market is not actively trading. Spreads may be wider and slippage higher.",
      action: "Low DEX volume means low conviction. Wait for volume to confirm any directional move.",
    },
    medium: {
      happening: "Steady swap activity is flowing through Uniswap V3.",
      why: "Normal trading conditions. Liquidity is being used and markets are functioning.",
      means: "Healthy market structure. Prices are being discovered in an orderly way.",
      action: "Good conditions for trading. Volume is confirming price movement.",
    },
    high: {
      happening: "Extreme swap volume is hitting Uniswap V3 right now.",
      why: "A token event, arbitrage wave, or market panic is driving massive trading activity.",
      means: "The market is in motion. Something big is happening and everyone is reacting.",
      action: "High DEX volume is the loudest signal. Find the catalyst and trade the direction.",
    },
  },
};

export function getMetricState(metric: string, value: number): MetricState {
  const thresholds: Record<string, [number, number]> = {
    GAS: [10, 40],
    TXS_PER_BLOCK: [100, 200],
    ACTIVE_ADDRESSES: [200, 600],
    WHALE_TRANSFERS: [1, 4],
    ETH_INTO_AAVE: [1, 10],
    LIQUIDATION_VOLUME: [1, 5],
    STABLES_MINTED_BURNED: [100000, 1000000],
    NEW_WALLET_CREATION: [2, 8],
    BRIDGE_INFLOWS_OUTFLOWS: [1, 10],
    DEX_VOLUME: [5, 20],
  };
  const t = thresholds[metric];
  if (!t) return "medium";
  const [low, high] = t;
  if (value <= low) return "low";
  if (value >= high) return "high";
  return "medium";
}

// ─── Perps market state ───────────────────────────────────────────────────────

type PerpsState = {
  history: Record<Market, number[]>;
  prev24: Record<Market, number>;
};

const perpsState: PerpsState = {
  history: { GAS: [], TXS_PER_BLOCK: [] },
  prev24: { GAS: 0, TXS_PER_BLOCK: 0 },
};

const perpsListeners = new Set<() => void>();
let perpsStarted = false;

async function fetchPrices() {
  try {
    const res = await fetch(KEEPER_API, { cache: "no-store" });
    const data = await res.json() as {
      GAS: number;
      TXS_PER_BLOCK: number;
      updatedAt: number;
    };

    const markets: Market[] = ["GAS", "TXS_PER_BLOCK"];

    for (const m of markets) {
      const value = (data as any)[m] ?? 0;
      if (perpsState.history[m].length === 0) {
        perpsState.prev24[m] = value;
      } else if (perpsState.history[m].length >= 1080) {
        perpsState.prev24[m] = perpsState.history[m][0];
      }
      perpsState.history[m] = [...perpsState.history[m].slice(-1199), value];
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
  return {
    GAS: gas,
    TXS_PER_BLOCK: txsPerBlock,
  };
}

export function getCurrent(m: Market) {
  const h = perpsState.history[m];
  return h[h.length - 1] ?? 0;
}

// ─── Network Feed state ───────────────────────────────────────────────────────

type FeedState = Record<FeedMetric, number>;

const feedState: FeedState = {
  ACTIVE_ADDRESSES: 0,
  WHALE_TRANSFERS: 0,
  ETH_INTO_AAVE: 0,
  LIQUIDATION_VOLUME: 0,
  STABLES_MINTED_BURNED: 0,
  NEW_WALLET_CREATION: 0,
  BRIDGE_INFLOWS_OUTFLOWS: 0,
  DEX_VOLUME: 0,
};

const feedListeners = new Set<() => void>();
let feedStarted = false;

async function fetchFeed() {
  try {
    const res = await fetch(`${KEEPER_API}/feed`, { cache: "no-store" });
    const data = await res.json() as FeedState & { updatedAt: number };
    const metrics: FeedMetric[] = [
      "ACTIVE_ADDRESSES",
      "WHALE_TRANSFERS",
      "ETH_INTO_AAVE",
      "LIQUIDATION_VOLUME",
      "STABLES_MINTED_BURNED",
      "NEW_WALLET_CREATION",
      "BRIDGE_INFLOWS_OUTFLOWS",
      "DEX_VOLUME",
    ];
    for (const m of metrics) {
      feedState[m] = data[m] ?? 0;
    }
    feedListeners.forEach((l) => l());
  } catch (err) {
    console.error("Feed fetch error:", err);
  }
}

function ensureFeedTimer() {
  if (feedStarted || typeof window === "undefined") return;
  feedStarted = true;
  fetchFeed();
  setInterval(fetchFeed, 15000);
}

export function useFeedMetric(m: FeedMetric) {
  const [, force] = useState(0);
  useEffect(() => {
    ensureFeedTimer();
    const fn = () => force((x) => x + 1);
    feedListeners.add(fn);
    return () => { feedListeners.delete(fn); };
  }, []);
  return feedState[m];
}

export function useNetworkFeed() {
  const [, force] = useState(0);
  useEffect(() => {
    ensureFeedTimer();
    const fn = () => force((x) => x + 1);
    feedListeners.add(fn);
    return () => { feedListeners.delete(fn); };
  }, []);
  return { ...feedState };
      }
