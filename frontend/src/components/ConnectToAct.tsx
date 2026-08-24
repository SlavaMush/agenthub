"use client";

import type { ReactNode } from "react";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import { Button } from "@/components/ui";
import { useUsdcBalance } from "@/lib/useUsdcBalance";

export function ConnectToAct({
  label,
  size = "md",
  className = "",
}: {
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing = size === "sm" ? "!h-9 !px-3.5 !text-xs" : "!h-10 !px-4 !text-sm";
  return (
    <Wallet>
      <ConnectWallet
        className={`!rounded-full !bg-gradient-mint !text-bg !font-semibold !border-0 hover:!brightness-110 ${sizing} ${className}`}
      >
        {label}
      </ConnectWallet>
    </Wallet>
  );
}

export function PayButton({
  connected,
  pending,
  disabled,
  disconnectedLabel,
  children,
  onClick,
  size = "md",
  className = "",
  variant = "primary",
}: {
  connected: boolean;
  pending?: boolean;
  disabled?: boolean;
  disconnectedLabel: string;
  children: ReactNode;
  onClick: () => void;
  size?: "sm" | "md";
  className?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  if (!connected) {
    return <ConnectToAct label={disconnectedLabel} size={size} className={className} />;
  }
  return (
    <Button size={size} variant={variant} className={className} disabled={disabled || pending} onClick={onClick}>
      {children}
    </Button>
  );
}

export function UsdcBalance({ className = "" }: { className?: string }) {
  const { isConnected, formatted } = useUsdcBalance();
  if (!isConnected || formatted == null) return null;
  return <span className={`font-mono text-[11px] text-text-muted ${className}`}>Balance {formatted} USDC</span>;
}
