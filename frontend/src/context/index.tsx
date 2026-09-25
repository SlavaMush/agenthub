"use client";

import { createAppKit } from "@reown/appkit/react";
import { base } from "@reown/appkit/networks";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiAdapter, wagmiConfig, projectId } from "@/config";

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [base],
  defaultNetwork: base,
  metadata: {
    name: "AgentHub",
    description: "Plain-English perp trading on Base",
    url: typeof window !== "undefined" ? window.location.origin : "https://agenthub.gg", // must match the serving domain
    icons: ["https://agenthub.gg/favicon.ico"],
  },
  // Veranta only accepts plain ECDSA signatures, so never hand out smart accounts or embedded wallets.
  defaultAccountTypes: { eip155: "eoa" },
  features: { analytics: false, email: false, socials: false, swaps: false, onramp: false },
  featuredWalletIds: [
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
    "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa", // Coinbase Wallet
  ],
  themeMode: "dark",
  themeVariables: { "--w3m-accent": "#00daa2", "--w3m-border-radius-master": "8px", "--w3m-font-family": "inherit" },
});

const qc = new QueryClient();

export default function ContextProvider({ children, cookies }: { children: React.ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);
  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
