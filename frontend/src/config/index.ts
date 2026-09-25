import { cookieStorage, createStorage } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base } from "@reown/appkit/networks";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
if (!projectId) console.error("NEXT_PUBLIC_REOWN_PROJECT_ID is not set: WalletConnect wallets won't load.");

export const wagmiAdapter = new WagmiAdapter({
  // Cast: the adapter pins its own @wagmi/core, whose Storage type differs nominally from wagmi's.
  storage: createStorage({ storage: cookieStorage }) as never,
  ssr: true,
  projectId,
  networks: [base],
  // Coinbase Wallet defaults to a Smart Wallet, whose signatures Veranta can't verify.
  connectors: [coinbaseWallet({ appName: "AgentHub", preference: { options: "eoaOnly" } })],
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
