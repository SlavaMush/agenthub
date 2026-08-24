import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { APP_CHAIN_ID } from "./app-config";

export const wagmiConfig = createConfig({
  chains: APP_CHAIN_ID === 8453 ? [base, baseSepolia] : [baseSepolia, base],
  connectors: [
    coinbaseWallet({
      appName: "AgentHub",
      preference: "all",
    }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
