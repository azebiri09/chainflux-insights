import { useEffect, useState } from "react";

const KEY = "chainflux:wallet";
const listeners = new Set<() => void>();

export function getWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function connectWallet(): string {
  const hex = "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  localStorage.setItem(KEY, hex);
  listeners.forEach((l) => l());
  return hex;
}

export function disconnectWallet() {
  localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function useWallet() {
  const [w, setW] = useState<string | null>(null);
  useEffect(() => {
    setW(getWallet());
    const fn = () => setW(getWallet());
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return w;
}

export function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}
