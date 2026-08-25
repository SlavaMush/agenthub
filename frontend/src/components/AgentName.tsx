"use client";

import Link from "next/link";
import { useAgentProfile } from "@/hooks/useAgentProfile";
import { shortAddr } from "@/lib/app-config";

export function AgentName({
  address,
  href,
  className,
}: {
  address: `0x${string}` | string;
  href?: string;
  className?: string;
}) {
  const { profile } = useAgentProfile(address);
  const label = profile?.name?.trim() || shortAddr(address);
  const cls = className ?? "text-mint hover:underline";
  const to = href ?? `/agents/${address}`;
  return (
    <Link href={to} className={cls} title={address}>
      {label}
    </Link>
  );
}
