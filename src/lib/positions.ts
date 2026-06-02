import { useEffect, useState } from "react";
import { ethers } from "ethers";

export type Market = "GAS" | "TXS_PER_BLOCK";
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
  cftMinted: number;
};

const PROXY_ADDRESS = "0x615d3801019D33609Eed27EB39D40AB49fa44fAF";

const ABI = [
  "function openPosition(uint8 market, uint8 direction, uint8 leverage) external payable",
  "function closePosition(uint256 id) external",
  "function getPosition(uint256 id) external view returns (tuple(address trader, uint8 market, uint8 direction, uint256 collateral, uint256 size, uint256 entryPrice, uint256 openedAt, uint256 cftMinted, bool open, uint8 leverage, uint256 liquidationPrice))",
  "function getUserPositions(address user) external view returns (uint256[])",
  "function getMarket(uint8 m) external view returns (uint256 price, uint256 updatedAt)"
];

const MARKET_INDEX: Record<Market, number> = { GAS: 0, TXS_PER_BLOCK: 2 };
const INDEX_MARKET: Record<number, Market> = { 0: "GAS", 2: "TXS_PER_BLOCK" };

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let cachedOpen: Position[] = [];
let cachedHist: Position[] = [];

const HIST_KEY = "chainflux:positions:history";
const LEV_KEY = "chainflux:positions:leverage";

function readHist(): Position[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}
function writeHist(v: Position[]) {
  localStorage.setItem(HIST_KEY, JSON.stringify(v));
}
function readLevMap(): Record<string, 2 | 5> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LEV_KEY) || "{}"); } catch { return {}; }
}
function writeLevMap(v: Record<string, 2 | 5>) {
  localStorage.setItem(LEV_KEY, JSON.stringify(v));
}

export function ethToCft(collateralEth: number, entryPrice: number): number {
  if (!entryPrice || entryPrice === 0) return 0;
  return collateralEth / entryPrice;
}

function decodeRevertReason(err: any): string {
  try {
    const data = err?.data ?? err?.error?.data ?? err?.info?.error?.data;
    if (!data) return err?.message ?? "Unknown error";

    if (typeof data === "string" && data.startsWith("0x08c379a0")) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["string"],
        "0x" + data.slice(10)
      );
      return decoded[0];
    }

    if (typeof data === "string" && data.startsWith("0x4e487b71")) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256"],
        "0x" + data.slice(10)
      );
      return `Panic: ${decoded[0]}`;
    }

    return `Raw revert: ${data}`;
  } catch {
    return err?.message ?? "Unknown error";
  }
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

  try {
    await contract.openPosition.staticCall(marketIndex, directionIndex, leverage, {
      value,
    });
  } catch (simErr: any) {
    const reason = decodeRevertReason(simErr);
    throw new Error(`Simulation failed: ${reason}`);
  }

  try {
    const tx = await contract.openPosition(marketIndex, directionIndex, leverage, {
      value,
      gasLimit: leverage === 5 ? 800000 : 600000,
    });
    const receipt = await tx.wait();

    const address = await signer.getAddress();
    const levMap = readLevMap();
    const pendingKey = `pending:${market}:${direction}:${receipt.blockNumber}`;
    levMap[pendingKey] = leverage;
    writeLevMap(levMap);

    await refreshPositions(address);
  } catch (txErr: any) {
    const reason = decodeRevertReason(txErr);
    throw new Error(`Transaction failed: ${reason}`);
  }
}

export async function closePosition(
  positionId: string,
  currentPrice: number
): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(PROXY_ADDRESS, ABI, signer);

  const tx = await contract.closePosition(BigInt(positionId), {
    gasLimit: 400000,
  });
  await tx.wait();

  const closed = cachedOpen.find((p) => p.id === positionId);
  if (closed) {
    const hist = readHist();
    hist.unshift({ ...closed, closePrice: currentPrice, closedAt: Date.now() });
    writeHist(hist);
  }

  const levMap = readLevMap();
  delete levMap[positionId];
  writeLevMap(levMap);

  await refreshPositions(await signer.getAddress());
}

export async function refreshPositions(address: string): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
    const contract = new ethers.Contract(PROXY_ADDRESS, ABI, provider);

    const ids: bigint[] = await contract.getUserPositions(address);
    const positions: Position[] = [];
    const levMap = readLevMap();

    await Promise.all(
      ids.map(async (id) => {
        const p = await contract.getPosition(id);
        if (p[0].open !== undefined ? p[0].open : p.open) {
          const pos = Array.isArray(p) ? p[0] : p;
          const idStr = id.toString();
          const storedLev: 2 | 5 = pos.leverage
            ? ((Number(pos.leverage) as 2 | 5) || levMap[idStr] || 2)
            : (levMap[idStr] ?? 2);

          const entryPrice = Number(pos.entryPrice) / 1e18;
          const collateral = Number(ethers.formatEther(pos.collateral));
          const cftMinted = Number(pos.cftMinted) / 1e18;

          positions.push({
            id: idStr,
            market: INDEX_MARKET[Number(pos.market)],
            direction: Number(pos.direction) === 0 ? "LONG" : "SHORT",
            leverage: storedLev,
            collateral,
            entryPrice,
            openedAt: Number(pos.openedAt) * 1000,
            cftMinted,
          });
        }
      })
    );

    const pendingEntries = Object.entries(levMap).filter(([k]) => k.startsWith("pending:"));
    if (pendingEntries.length > 0) {
      const unassigned = positions.filter((p) => !levMap[p.id]);
      pendingEntries.forEach(([pendingKey, lev], i) => {
        if (unassigned[i]) {
          levMap[unassigned[i].id] = lev as 2 | 5;
          unassigned[i].leverage = lev as 2 | 5;
        }
        delete levMap[pendingKey];
      });
      writeLevMap(levMap);
    }

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
