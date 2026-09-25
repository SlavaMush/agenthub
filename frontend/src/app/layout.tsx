import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-jb" });

export const metadata: Metadata = {
  title: "AgentHub: AI perp trading agent on Base",
  description: "Trade perpetual futures on Base in plain English. Your limits, your wallet, any agent: web, Telegram, MCP and Bankr.",
  other: {
    "base:app_id": "6ab5f8bd81234bc7e80b13b9",
  },
};

export const viewport: Viewport = { themeColor: "#07080a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieHeader = (await headers()).get("cookie");
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="font-sans">
        <ContextProvider cookies={cookieHeader}>{children}</ContextProvider>
      </body>
    </html>
  );
}
