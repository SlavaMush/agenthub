"use client";

import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity";
import { useAccount, useChainId, useReadContract, useSwitchChain } from "wagmi";
import { agentHubAbi } from "@agenthub/config";
import { APP_CHAIN_ID, chain as appChain, contracts, hasContract } from "@/lib/app-config";
import { appViemChain } from "@/lib/chains";

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
    <div className="flex items-center gap-2">
      <span className="hidden lg:inline-flex items-center gap-2 h-9 px-3 rounded-full border border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.14em] text-text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_#00e3ab]" />
        {appChain.displayName}
      </span>
      {wrongNetwork && (
        <button
          onClick={() => switchChain({ chainId: appViemChain.id })}
          className="h-9 px-3 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/30"
        >
          Switch network
        </button>
      )}
      {isConnected && isAgent === true && (
        <span className="hidden md:inline-flex h-9 items-center px-3 rounded-full bg-mint/10 text-mint text-[11px] font-semibold border border-mint/25">
          ERC-8004
        </span>
      )}
      <Wallet>
        <ConnectWallet className="!h-10 !rounded-full !px-4 !bg-gradient-mint !text-bg !font-semibold !border-0 hover:!brightness-110">
          <Avatar className="h-5 w-5" />
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
