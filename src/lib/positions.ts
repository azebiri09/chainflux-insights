import { useEffect, useState } from "react";
import { ethers } from "ethers";

export type Market = "GAS" | "ACTIVITY" | "FLOW";
export type Position = {
  id: string;
  market: Market;
  direction: "LONG" | "SHORT";
  size: number;
  entry: number;
  openedAt: number;
  closedAt?: number;
  close?: number;
};

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";

const ABI = [
  "function openPosition(uint8 market, bool isLong, uint256 size) external payable",
  "function closePosition(uint256 positionId) external",
  "function getPosition(uint256 positionId) external view returns (address trader, uint8 market, bool isLong, uint256 size, uint256 entryPrice, bool isOpen)",
  "function getUserPositions(address user) external view returns (uint256[])"
];

const MARKET_INDEX: Record<Market, number> = {
  GAS: 0,
  ACTIVITY: 1,
  FLOW: 2
};

const INDEX_MARKET: Record<number, Market> = {
  0: "GAS",
  1: "ACTIVITY",
  2: "FLOW"
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let cachedOpen: Position[] = [];
let cachedHist: Position[] = [];

// Local history storage
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
  isLong: boolean,
  size: number
): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(PROXY_ADDRESS, ABI, signer);

  const fee = ethers.parseEther((size * 0.003).toFixed(6));
  const tx = await contract.openPosition(
    MARKET_INDEX[market],
    isLong,
    ethers.parseUnits(size.toString(), 8),
    { value: fee }
  );
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

  // Move to local history
  const closed = cachedOpen.find((p) => p.id === positionId);
  if (closed) {
    const hist = readHist();
    hist.unshift({ ...closed, close: currentPrice, closedAt: Date.now() });
    writeHist(hist);
  }

  await refreshPositions(await signer.getAddress());
}

export async function refreshPositions(address: string): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider(
      "https://sepolia-rollup.arbitrum.io/rpc"
    );
    const contract = new ethers.Contract(PROXY_ADDRESS, ABI, provider);

    const ids: bigint[] = await contract.getUserPositions(address);
    const positions: Position[] = [];

    await Promise.all(
      ids.map(async (id) => {
        const p = await contract.getPosition(id);
        if (p.isOpen) {
          positions.push({
            id: id.toString(),
            market: INDEX_MARKET[Number(p.market)],
            direction: p.isLong ? "LONG" : "SHORT",
            size: Number(ethers.formatUnits(p.size, 8)),
            entry: Number(p.entryPrice) / 1e8,
            openedAt: Date.now(),
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

export function pnl(p: Position, current: number) {
  const diff = p.direction === "LONG"
    ? current - p.entry
    : p.entry - current;
  return diff * p.size;
                                       }
