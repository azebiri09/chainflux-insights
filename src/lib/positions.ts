import { useEffect, useState } from "react";

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

const OPEN_KEY = "chainflux:positions:open";
const HIST_KEY = "chainflux:positions:history";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(k: string): Position[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
}
function write(k: string, v: Position[]) { localStorage.setItem(k, JSON.stringify(v)); }

export function openPosition(p: Omit<Position, "id" | "openedAt">) {
  const open = read(OPEN_KEY);
  open.push({ ...p, id: Math.random().toString(36).slice(2), openedAt: Date.now() });
  write(OPEN_KEY, open);
  notify();
}
export function closePosition(id: string, currentPrice: number) {
  const open = read(OPEN_KEY);
  const idx = open.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const p = open[idx];
  open.splice(idx, 1);
  write(OPEN_KEY, open);
  const hist = read(HIST_KEY);
  hist.unshift({ ...p, close: currentPrice, closedAt: Date.now() });
  write(HIST_KEY, hist);
  notify();
}
export function usePositions() {
  const [open, setOpen] = useState<Position[]>([]);
  const [hist, setHist] = useState<Position[]>([]);
  useEffect(() => {
    const refresh = () => { setOpen(read(OPEN_KEY)); setHist(read(HIST_KEY)); };
    refresh();
    listeners.add(refresh);
    return () => { listeners.delete(refresh); };
  }, []);
  return { open, hist };
}

export function pnl(p: Position, current: number) {
  const diff = p.direction === "LONG" ? current - p.entry : p.entry - current;
  return diff * p.size;
}
