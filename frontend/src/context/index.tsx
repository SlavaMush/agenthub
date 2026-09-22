"use client";

import { createAppKit } from "@reown/appkit/react";
import { base } from "@reown/appkit/networks";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiAdapter, wagmiConfig, projectId } from "@/config";

const metadata = {
  name: "AgentHub",
  description: "Agent-to-agent trading network on Base",
  url: typeof window !== "undefined" ? window.location.origin : "https://agenthub.gg",
  icons: [],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [base] as any,
  defaultNetwork: base,
  metadata,
  features: { analytics: false, email: false, socials: false },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#00daa2",
    "--w3m-color-mix": "#00daa2",
    "--w3m-color-mix-strength": 22,
    "--w3m-border-radius-master": "8px",
    "--w3m-font-family": "inherit",
  },
});

const qc = new QueryClient();

export default function ContextProvider({
  children,
  cookies,
}: {
  children: React.ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);
  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
