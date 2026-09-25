import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base } from "@reown/appkit/networks";
import { coinbaseWallet } from "wagmi/connectors";

export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  "";

export const networks = [base] as any;

// Force Coinbase connector to EOA-only mode. Veranta's setDelegateWithSig expects
// a raw ECDSA signature and cannot verify EIP-1271 / EIP-6492 wrapped signatures
// from Coinbase Smart Wallet. Without this, AppKit's default CB connector offers
// a Smart Wallet by default, which produces signatures pass wagmi but fail
// on-chain at the Veranta delegate contract.
const coinbaseEOAConnector = coinbaseWallet({
  appName: "AgentHub",
  preference: "eoaOnly" as any,
});

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }) as any,
  ssr: true,
  projectId,
  networks,
  connectors: [coinbaseEOAConnector],
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
