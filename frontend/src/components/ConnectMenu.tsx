"use client";

import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity";
import { useAccount, useChainId, useReadContract, useSwitchChain } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { agentHubAbi } from "@agenthub/config";
import { APP_CHAIN_ID, chain as appChain, contracts, hasContract } from "@/lib/app-config";

export function ConnectMenu() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== APP_CHAIN_ID;

  const { data: isAgent } = useReadContract({
    address: contracts.agentHub,
    abi: agentHubAbi,
    functionName: "isAgent",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContract(contracts.agentHub)) },
  });

  return (
    <div className="flex items-center gap-3">
      <span className="text-text-muted text-sm hidden sm:block">{appChain.displayName}</span>
      {wrongNetwork && (
        <button
          onClick={() => switchChain({ chainId: APP_CHAIN_ID === 8453 ? base.id : baseSepolia.id })}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
        >
          Switch network
        </button>
      )}
      {isConnected && isAgent === true && (
        <span className="hidden md:inline px-2 py-0.5 rounded-full bg-mint/10 text-mint text-xs border border-mint/30">
          ERC-8004
        </span>
      )}
      <Wallet>
        <ConnectWallet className="bg-bg-elevated border border-border hover:border-mint/50 rounded-xl px-3 py-2">
          <Avatar className="h-6 w-6" />
          <Name />
        </ConnectWallet>
        <WalletDropdown>
          <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
            <Avatar />
            <Name />
            <Address />
          </Identity>
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>
    </div>
  );
}
