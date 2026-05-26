import { useEffect, useState } from "react";

const CHAIN_ID = "0x66eee"; // Arbitrum Sepolia (421614 in hex)
const listeners = new Set<() => void>();

export function getWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("chainflux:wallet");
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    alert("No wallet found. Please install Brave Wallet or MetaMask.");
    throw new Error("No wallet");
  }

  // Request wallet connection
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  // Switch to Arbitrum Sepolia
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID }],
    });
  } catch (e: any) {
    // Chain not added yet — add it
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID,
          chainName: "Arbitrum Sepolia",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
          blockExplorerUrls: ["https://sepolia.arbiscan.io"],
        }],
      });
    }
  }

  const address = accounts[0];
  localStorage.setItem("chainflux:wallet", address);
  listeners.forEach((l) => l());
  return address;
}

export function disconnectWallet() {
  localStorage.removeItem("chainflux:wallet");
  listeners.forEach((l) => l());
}

export function useWallet() {
  const [w, setW] = useState<string | null>(null);
  useEffect(() => {
    setW(getWallet());
    const fn = () => setW(getWallet());
    listeners.add(fn);

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          localStorage.setItem("chainflux:wallet", accounts[0]);
          listeners.forEach((l) => l());
        }
      });
    }

    return () => { listeners.delete(fn); };
  }, []);
  return w;
}

export function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
      }
