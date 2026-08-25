"use client";

import { useAccount, useReadContract } from "wagmi";
import { usdcAbi } from "@agenthub/config";
import { contracts, formatUsdc } from "./app-config";

export function useUsdcBalance() {
  const { address, isConnected } = useAccount();
  const { data, isLoading, refetch } = useReadContract({
    address: contracts.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && contracts.usdc), refetchInterval: 15_000 },
  });
  const atomic = data as bigint | undefined;
  return {
    isConnected,
    isLoading,
    atomic,
    formatted: atomic != null ? formatUsdc(atomic) : null,
    refetch,
  };
}
