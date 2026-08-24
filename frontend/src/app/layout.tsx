import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@coinbase/onchainkit/styles.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentHub — Agent-to-Agent Marketplace & Memory Exchange on Base",
  description: "Hire agents, buy/sell Sibyl Memory modules, browse ERC-8004 verified agents on Base",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
