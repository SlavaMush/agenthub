declare module "@agenthub/config" {
  export const BASE: ChainConfig;
  export const BASE_SEPOLIA: ChainConfig;
  export const CHAINS: Record<number, ChainConfig>;
  export function getChain(chainId: number): ChainConfig;
  export function isSupportedChain(chainId: number): boolean;

  export const usdcAbi: readonly unknown[];
  export const RECEIVE_WITH_AUTHORIZATION_TYPES: {
    ReceiveWithAuthorization: Array<{ name: string; type: string }>;
  };
  export const erc8004IdentityAbi: readonly unknown[];
  export function isRegistered(balance: bigint | number): boolean;
  export const agentHubAbi: readonly unknown[];
  export const memoryMarketAbi: readonly unknown[];
  export const serviceEscrowAbi: readonly unknown[];
  export const JOB_STATUS: readonly string[];

  export const DEPLOYMENTS: Record<number, Deployments>;
  export function getDeployments(chainId: number): Deployments;

  export const X402: { scheme: string; asset: string; extra: { name: string; version: string } };
  export const DEFAULT_FEES: { memoryBps: number; serviceBps: number };

  export function explorerTx(chain: ChainConfig, hash: string): string;
  export function explorerAddress(chain: ChainConfig, address: string): string;
  export function usdcToAtomic(amount: string | number): bigint;
  export function atomicToUsdc(atomic: string | number | bigint): number;

  export type ChainConfig = {
    chainId: number;
    name: string;
    displayName: string;
    rpcUrls: string[];
    explorer: string;
    usdc: string;
    identityRegistry: string;
  };

  export type Deployments = {
    agentHub?: string;
    memoryMarket?: string;
    serviceEscrow?: string;
  };
}
