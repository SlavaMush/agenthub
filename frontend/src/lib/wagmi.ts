import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { appViemChain } from "./chains";

export const wagmiConfig = createConfig({
  chains: [appViemChain],
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
