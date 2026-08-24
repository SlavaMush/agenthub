"use client";

import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  usdcAbi,
  memoryMarketAbi,
  serviceEscrowAbi,
  erc8004IdentityAbi,
} from "@agenthub/config";
import { contracts, hasContract, parseUsdcInput } from "./app-config";

function requireAddr(value: `0x${string}` | undefined, label: string): `0x${string}` {
  if (!hasContract(value) || !value) throw new Error(`${label} is not deployed`);
  return value;
}

export function useMarketplace() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  async function send(params: Parameters<typeof writeContractAsync>[0]) {
    if (!publicClient) throw new Error("Wallet client not ready");
    const hash = await writeContractAsync(params);
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function approveIfNeeded(spender: `0x${string}`, amount: bigint) {
    if (!address || !publicClient) throw new Error("Connect a wallet first");
    const allowance = (await publicClient.readContract({
      address: contracts.usdc,
      abi: usdcAbi,
      functionName: "allowance",
      args: [address, spender],
    })) as bigint;
    if (allowance >= amount) return;
    await send({
      address: contracts.usdc,
      abi: usdcAbi,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  return {
    address,
    isConnected,
    isPending,
    async listMemory(cid: string, uri: string, price: string) {
      const memoryMarket = requireAddr(contracts.memoryMarket, "Memory market");
      return send({
        address: memoryMarket,
        abi: memoryMarketAbi,
        functionName: "list",
        args: [cid, uri || `ipfs://${cid}`, parseUsdcInput(price)],
      });
    },
    async buyMemory(tokenId: number, priceAtomic: string) {
      const memoryMarket = requireAddr(contracts.memoryMarket, "Memory market");
      await approveIfNeeded(memoryMarket, BigInt(priceAtomic));
      return send({
        address: memoryMarket,
        abi: memoryMarketAbi,
        functionName: "buy",
        args: [BigInt(tokenId)],
      });
    },
    async listService(uri: string, price: string, durationHours: string) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      const seconds = BigInt(Math.round(Number(durationHours) * 3600));
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "list",
        args: [uri, parseUsdcInput(price), seconds],
      });
    },
    async fundService(jobId: number, priceAtomic: string) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      await approveIfNeeded(serviceEscrow, BigInt(priceAtomic));
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "fund",
        args: [BigInt(jobId)],
      });
    },
    async registerAgent(uri: string) {
      const identityRegistry = requireAddr(contracts.identityRegistry, "Identity registry");
      return send({
        address: identityRegistry,
        abi: erc8004IdentityAbi,
        functionName: "register",
        args: [uri],
      });
    },
  };
}
