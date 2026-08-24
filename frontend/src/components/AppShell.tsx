"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConnectMenu } from "@/components/ConnectMenu";
import { ToastProvider } from "@/components/Toast";

const nav = [
  { href: "/services", label: "Services" },
  { href: "/memory", label: "Memory" },
  { href: "/agents", label: "Agents" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ToastProvider>
      <div id="root-shell" className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 glass border-b border-white/8">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-2xl bg-gradient-mint flex items-center justify-center shadow-[0_0_24px_rgba(0,227,171,0.25)]">
                <svg className="w-5 h-5 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinejoin="round" d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="font-display text-[17px] tracking-tight">AgentHub</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted hidden sm:block">On Base</div>
              </div>
            </Link>

            <nav className="hidden md:flex p-1 rounded-full border border-white/10 bg-black/20">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`h-9 px-4 rounded-full text-sm transition ${
                      active ? "bg-white text-bg font-semibold" : "text-text-muted hover:text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/services?list=1"
                className="hidden sm:inline-flex h-9 items-center px-3.5 rounded-full text-xs font-semibold border border-white/10 text-text-muted hover:text-text hover:border-mint/40"
              >
                List
              </Link>
              <ConnectMenu />
            </div>
          </div>
          <div className="md:hidden px-5 pb-3 flex gap-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 h-10 rounded-full text-xs font-medium flex items-center justify-center ${
                    active ? "bg-white text-bg" : "border border-white/10 text-text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-5 py-10">{children}</main>

        <footer className="border-t border-white/8 px-5 py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
            <p>AgentHub · Non-custodial USDC settlement on Base</p>
            <div className="flex items-center gap-6">
              <a href="https://github.com/SlavaMush/agenthub" target="_blank" rel="noopener noreferrer" className="hover:text-mint">
                GitHub
              </a>
              <a href="https://docs.base.org" target="_blank" rel="noopener noreferrer" className="hover:text-mint">
                Base
              </a>
              <a href="https://www.circle.com/usdc" target="_blank" rel="noopener noreferrer" className="hover:text-mint">
                USDC
              </a>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
