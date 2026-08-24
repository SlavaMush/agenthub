"use client";

import { useAccount, usePublicClient, useSignTypedData, useWriteContract } from "wagmi";
import { parseSignature, toHex } from "viem";
import {
  usdcAbi,
  memoryMarketAbi,
  serviceEscrowAbi,
  erc8004IdentityAbi,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
} from "@agenthub/config";
import { APP_CHAIN_ID, contracts, hasContract, parseUsdcInput } from "./app-config";

function requireAddr(value: `0x${string}` | undefined, label: string): `0x${string}` {
  if (!hasContract(value) || !value) throw new Error(`${label} is not deployed`);
  return value;
}

export function useMarketplace() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

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

  function isUserReject(err: unknown) {
    return /user rejected|denied|rejected the request/i.test(err instanceof Error ? err.message : String(err));
  }

  async function signReceiveAuth(to: `0x${string}`, value: bigint) {
    if (!address) throw new Error("Connect a wallet first");
    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const signature = await signTypedDataAsync({
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: APP_CHAIN_ID,
        verifyingContract: contracts.usdc,
      },
      types: RECEIVE_WITH_AUTHORIZATION_TYPES,
      primaryType: "ReceiveWithAuthorization",
      message: {
        from: address,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
      },
    });
    const parsed = parseSignature(signature);
    return {
      validAfter,
      validBefore,
      nonce,
      v: Number(parsed.v),
      r: parsed.r,
      s: parsed.s,
    };
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
      const value = BigInt(priceAtomic);
      try {
        const auth = await signReceiveAuth(memoryMarket, value);
        return await send({
          address: memoryMarket,
          abi: memoryMarketAbi,
          functionName: "buyWithAuthorization",
          args: [BigInt(tokenId), auth.validAfter, auth.validBefore, auth.nonce, auth.v, auth.r, auth.s],
        });
      } catch (err) {
        if (isUserReject(err)) throw err;
      }
      await approveIfNeeded(memoryMarket, value);
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
      const value = BigInt(priceAtomic);
      try {
        const auth = await signReceiveAuth(serviceEscrow, value);
        return await send({
          address: serviceEscrow,
          abi: serviceEscrowAbi,
          functionName: "fundWithAuthorization",
          args: [BigInt(jobId), auth.validAfter, auth.validBefore, auth.nonce, auth.v, auth.r, auth.s],
        });
      } catch (err) {
        if (isUserReject(err)) throw err;
      }
      await approveIfNeeded(serviceEscrow, value);
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
    async deliverService(jobId: number, cid: string) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "deliver",
        args: [BigInt(jobId), cid],
      });
    },
    async confirmService(jobId: number) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "confirm",
        args: [BigInt(jobId)],
      });
    },
    async autoReleaseService(jobId: number) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "autoRelease",
        args: [BigInt(jobId)],
      });
    },
    async refundService(jobId: number) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "timeoutRefund",
        args: [BigInt(jobId)],
      });
    },
    async freezeService(jobId: number) {
      const serviceEscrow = requireAddr(contracts.serviceEscrow, "Service escrow");
      return send({
        address: serviceEscrow,
        abi: serviceEscrowAbi,
        functionName: "freeze",
        args: [BigInt(jobId)],
      });
    },
    async delistMemory(tokenId: number) {
      const memoryMarket = requireAddr(contracts.memoryMarket, "Memory market");
      return send({
        address: memoryMarket,
        abi: memoryMarketAbi,
        functionName: "delist",
        args: [BigInt(tokenId)],
      });
    },
  };
}
