import { useEffect, useState } from "react";
import { ethers } from "ethers";

export type Market = "GAS" | "AAVE_BORROWS" | "TXS_PER_BLOCK";
export type Position = {
  id: string;
  market: Market;
  direction: "LONG" | "SHORT";
  leverage: 2 | 5;
  collateral: number;
  entryPrice: number;
  openedAt: number;
  closedAt?: number;
  closePrice?: number;
};

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";

const ABI = [
  "function openPosition(uint8 market, uint8 direction, uint8 leverage) external payable",
  "function closePosition(uint256 id) external",
  "function getPosition(uint256 id) external view returns (address trader, uint8 market, uint8 direction, uint256 collateral, uint256 size, uint256 entryPrice, uint256 openedAt, uint256 cftMinted, bool open)",
  "function getUserPositions(address user) external view returns (uint256[])",
  "function getMarket(uint8 m) external view returns (uint256 price, uint256 updatedAt, uint256 longOI, uint256 shortOI)"
];

const MARKET_INDEX: Record<Market, number> = { GAS: 0, AAVE_BORROWS: 1, TXS_PER_BLOCK: 2 };
const INDEX_MARKET: Record<number, Market> = { 0: "GAS", 1: "AAVE_BORROWS", 2: "TXS_PER_BLOCK" };

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let cachedOpen: Position[] = [];
let cachedHist: Position[] = [];

const HIST_KEY = "chainflux:positions:history";
function readHist(): Position[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}
function writeHist(v: Position[]) {
  localStorage.setItem(HIST_KEY, JSON.stringify(v));
}

export async function openPosition(
  market: Market,
  direction: "LONG" | "SHORT",
  collateralEth: number,
  leverage: 2 | 5
): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(PROXY_ADDRESS, ABI, signer);

  const marketIndex = MARKET_INDEX[market];
  const directionIndex = direction === "LONG" ? 0 : 1;
  const value = ethers.parseEther(collateralEth.toFixed(6));

  const tx = await contract.openPosition(marketIndex, directionIndex, leverage, { value });
  await tx.wait();
  await refreshPositions(await signer.getAddress());
}

export async function closePosition(
  positionId: string,
  currentPrice: number
): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(PROXY_ADDRESS, ABI, signer);

  const tx = await contract.closePosition(BigInt(positionId));
  await tx.wait();

  const closed = cachedOpen.find((p) => p.id === positionId);
  if (closed) {
    const hist = readHist();
    hist.unshift({ ...closed, closePrice: currentPrice, closedAt: Date.now() });
    writeHist(hist);
  }

  await refreshPositions(await signer.getAddress());
}

export async function refreshPositions(address: string): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
    const contract = new ethers.Contract(PROXY_ADDRESS, ABI, provider);

    const ids: bigint[] = await contract.getUserPositions(address);
    const positions: Position[] = [];

    await Promise.all(
      ids.map(async (id) => {
        const p = await contract.getPosition(id);
        if (p.open) {
          positions.push({
            id: id.toString(),
            market: INDEX_MARKET[Number(p.market)],
            direction: Number(p.direction) === 0 ? "LONG" : "SHORT",
            leverage: (Number(p.leverage) === 5 ? 5 : 2) as 2 | 5,
            collateral: Number(ethers.formatEther(p.collateral)),
            entryPrice: Number(p.entryPrice) / 1e18,
            openedAt: Number(p.openedAt) * 1000,
          });
        }
      })
    );

    cachedOpen = positions;
    cachedHist = readHist();
    notify();
  } catch (err) {
    console.error("Position fetch error:", err);
  }
}

export function usePositions(address?: string | null) {
  const [open, setOpen] = useState<Position[]>([]);
  const [hist, setHist] = useState<Position[]>([]);

  useEffect(() => {
    const refresh = () => {
      setOpen([...cachedOpen]);
      setHist([...cachedHist]);
    };
    refresh();
    listeners.add(refresh);
    if (address) refreshPositions(address);
    return () => { listeners.delete(refresh); };
  }, [address]);

  return { open, hist };
}

export function pnl(p: Position, currentPrice: number): number {
  const diff = p.direction === "LONG"
    ? currentPrice - p.entryPrice
    : p.entryPrice - currentPrice;
  return (diff / p.entryPrice) * p.collateral * p.leverage;
}
