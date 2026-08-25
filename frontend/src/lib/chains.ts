import { defineChain } from "viem";
import { base as baseMainnet, baseSepolia } from "wagmi/chains";
import { APP_CHAIN_ID } from "./app-config";

const source = APP_CHAIN_ID === 8453 ? baseMainnet : baseSepolia;

/** Wallet + OnchainKit chain. Product copy is always Base; chain id follows env for live tests. */
export const appViemChain = defineChain({
  ...source,
  name: "Base",
  testnet: false,
});
