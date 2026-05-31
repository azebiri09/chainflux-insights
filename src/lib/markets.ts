import { useEffect, useState } from "react";

export type Market = "GAS" | "TXS_PER_BLOCK";

export type FeedMetric =
  | "ACTIVE_ADDRESSES"
  | "WHALE_TRANSFERS"
  | "ETH_LARGE_TRANSFERS"
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
  ETH_LARGE_TRANSFERS: "ETH Large Transfers",
  LIQUIDATION_VOLUME: "Liquidation Volume",
  STABLES_MINTED_BURNED: "Stables Minted / Burned",
  NEW_WALLET_CREATION: "New Wallet Creation",
  BRIDGE_INFLOWS_OUTFLOWS: "Bridge Inflows / Outflows",
  DEX_VOLUME: "DEX Volume",
};

export const FEED_UNITS: Record<FeedMetric, string> = {
  ACTIVE_ADDRESSES: "addresses",
  WHALE_TRANSFERS: "txs",
  ETH_LARGE_TRANSFERS: "transfers",
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
      happening: "Barely anyone is transacting on Ethereum right now.",
      why: "Traders and users are sitting on the sidelines. Nobody wants to make a move yet.",
      means: "The network is in a quiet phase. Things can flip fast when activity returns.",
      action: "When addresses start spiking after a quiet period like this, momentum usually follows quickly.",
    },
    medium: {
      happening: "A decent number of wallets are active on the network right now.",
      why: "Normal participation across the board. Nothing extreme but the chain is alive and moving.",
      means: "Standard operating conditions. Liquidity is healthy and the market is functioning well.",
      action: "No rush. Keep an eye out for a breakout in activity before making any big moves.",
    },
    high: {
      happening: "A huge wave of wallets just hit the network at the same time.",
      why: "Something triggered mass participation. Could be a token launch, news event, or bot activity.",
      means: "The network is in high demand right now. Gas is likely rising and something is moving.",
      action: "Act fast or wait for things to calm down. High activity like this rarely stays quiet for long.",
    },
  },
  WHALE_TRANSFERS: {
    low: {
      happening: "No significant ETH transfers from large holders right now.",
      why: "Whales are sitting still. No major capital is moving on chain at this moment.",
      means: "The market is being driven by smaller players only. Big money is watching from the sidelines.",
      action: "Lower volatility expected. Good time for precise entries without getting run over.",
    },
    medium: {
      happening: "A few large ETH transfers are moving through the network.",
      why: "Some big holders are repositioning. Not alarming but worth paying attention to.",
      means: "Smart money is quietly active. The direction of these transfers could be a clue.",
      action: "Stay alert. Mid level whale activity often picks up before something bigger happens.",
    },
    high: {
      happening: "Multiple massive ETH transfers just went through the network.",
      why: "Large holders are moving capital aggressively. This is not normal retail behavior.",
      means: "Something is happening at the institutional level. Liquidity is shifting in a big way.",
      action: "This is your signal. Whale activity at this scale almost always comes before major price action.",
    },
  },
  ETH_LARGE_TRANSFERS: {
    low: {
      happening: "Very little large ETH is moving across the network right now.",
      why: "Big capital is sitting still. No serious money is changing hands on chain.",
      means: "The market lacks the fuel for a big move. Things are calm at the top end.",
      action: "Watch for a sudden spike. When large transfers pick up after silence, a move is usually coming.",
    },
    medium: {
      happening: "A steady flow of large ETH transfers is happening across the network.",
      why: "Capital is moving around normally. Some big players are repositioning without urgency.",
      means: "Healthy market conditions. Money is flowing but nothing extreme is happening yet.",
      action: "Use this as your baseline. Any jump from here is worth watching closely.",
    },
    high: {
      happening: "Large ETH transfers are spiking hard across the network right now.",
      why: "Serious capital is on the move. Multiple big holders are transacting at the same time.",
      means: "Something is being set up. This level of capital movement usually precedes a significant price event.",
      action: "Pay close attention. When this much ETH moves at once someone is making a big bet.",
    },
  },
  LIQUIDATION_VOLUME: {
    low: {
      happening: "No liquidations happening on Aave right now.",
      why: "Borrowers are healthy and collateral levels are fine. Nobody is underwater.",
      means: "The market is stable. No forced selling is adding any pressure to prices.",
      action: "Clean conditions for opening positions. No cascade risk to worry about right now.",
    },
    medium: {
      happening: "A small number of liquidations are trickling through Aave.",
      why: "A few traders got caught offside. Prices moved just enough to trigger some margin calls.",
      means: "Small pockets of stress are showing up. Could be isolated or the start of something bigger.",
      action: "Keep watching. A few liquidations can snowball fast if prices keep moving in the same direction.",
    },
    high: {
      happening: "Liquidations are spiking on Aave right now. A lot of people got caught overleveraged and are getting wiped out.",
      why: "Prices made a sharp move and over leveraged borrowers could not hold on.",
      means: "Forced selling is accelerating the move. This kind of pressure can push prices even further.",
      action: "Watch yourself out there. Cascades are fast and brutal. If you are trading the direction size down.",
    },
  },
  STABLES_MINTED_BURNED: {
    low: {
      happening: "Barely any USDC is being minted or burned right now.",
      why: "No large capital is entering or leaving crypto markets at this moment.",
      means: "The market is in a holding pattern. No fresh money is coming in and nobody is cashing out.",
      action: "Wait for this to spike. A surge in minting means fresh capital is about to hit the market.",
    },
    medium: {
      happening: "A normal amount of USDC is moving in and out of circulation.",
      why: "Routine capital movement across the stablecoin ecosystem. Nothing unusual.",
      means: "The market is functioning as expected. No extraordinary pressure in either direction.",
      action: "Use this as your baseline. Any deviation from this level is worth paying attention to.",
    },
    high: {
      happening: "Massive USDC minting or burning is happening right now.",
      why: "A large institution or protocol is moving serious capital through the stablecoin layer.",
      means: "Either fresh money is flooding into crypto or someone big is cashing out at scale.",
      action: "This is a macro signal. Large stablecoin flows almost always come before a significant market move.",
    },
  },
  NEW_WALLET_CREATION: {
    low: {
      happening: "Barely any new wallets or contracts are being created right now.",
      why: "No new users are onboarding and no new contracts are being deployed at this moment.",
      means: "The network is not attracting new participants right now. Things are quiet.",
      action: "Normal during slow periods. Watch for spikes during news events or major announcements.",
    },
    medium: {
      happening: "A normal number of new wallets and contracts are being created.",
      why: "Steady onboarding of new users and routine smart contract deployments.",
      means: "Healthy growth at a sustainable rate. The ecosystem is ticking along fine.",
      action: "Nothing urgent here. Use as background context for overall network health.",
    },
    high: {
      happening: "New wallets are being created at an unusually high rate right now.",
      why: "A bot wave, airdrop farming, or something viral is driving mass wallet creation.",
      means: "Something is pulling in a flood of new participants. Network activity is about to spike.",
      action: "Find out what is driving this. New wallet surges almost always lead to gas spikes and volume explosions.",
    },
  },
  BRIDGE_INFLOWS_OUTFLOWS: {
    low: {
      happening: "Very little ETH is crossing the Arbitrum bridge right now.",
      why: "Users are not actively moving capital between Ethereum and Arbitrum at this moment.",
      means: "Arbitrum liquidity is stable. No major pressure coming in or going out.",
      action: "The liquidity you see on Arbitrum right now is what you have got. Watch for changes.",
    },
    medium: {
      happening: "A steady flow of ETH is moving through the Arbitrum bridge.",
      why: "Normal cross chain activity. Capital is moving between Ethereum and Arbitrum as expected.",
      means: "Healthy liquidity flow. The bridge is being used normally and conditions are stable.",
      action: "Nothing unusual here. Conditions are normal for trading on Arbitrum.",
    },
    high: {
      happening: "Large amounts of ETH are crossing the Arbitrum bridge right now.",
      why: "Capital is flooding in or rushing out of Arbitrum at an unusually high rate.",
      means: "A major liquidity event is in motion. Arbitrum is either attracting serious capital or losing it fast.",
      action: "This is a directional signal. Heavy inflows are bullish for Arbitrum activity. Heavy outflows are the opposite.",
    },
  },
  DEX_VOLUME: {
    low: {
      happening: "Very few swaps are going through Uniswap right now.",
      why: "Trading activity on decentralized exchanges has dried up. Liquidity is sitting idle.",
      means: "The market is not actively trading. Spreads could be wider and slippage higher than usual.",
      action: "Low volume means low conviction. Wait for volume to pick up before trusting any price move.",
    },
    medium: {
      happening: "Steady swap activity is flowing through Uniswap right now.",
      why: "Normal trading conditions. Liquidity is being used and prices are being discovered properly.",
      means: "Healthy market structure. Things are orderly and conditions are good for trading.",
      action: "Good time to trade. Volume is confirming price movement and conditions are clean.",
    },
    high: {
      happening: "Swap volume on Uniswap is going through the roof right now.",
      why: "A token event, arbitrage wave, or market panic is driving massive trading activity.",
      means: "The market is in full motion. Something big is happening and everyone is reacting to it.",
      action: "High DEX volume is one of the loudest signals you can get. Find the catalyst and trade the direction.",
    },
  },
};

export function getMetricState(metric: string, value: number): MetricState {
  const thresholds: Record<string, [number, number]> = {
    GAS: [10, 40],
    TXS_PER_BLOCK: [100, 200],
    ACTIVE_ADDRESSES: [200, 600],
    WHALE_TRANSFERS: [1, 4],
    ETH_LARGE_TRANSFERS: [10, 50],
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
  ETH_LARGE_TRANSFERS: 0,
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
      "ETH_LARGE_TRANSFERS",
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
