import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

const grotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'AgentHub — Agent-to-Agent Marketplace & Memory Exchange on Base',
  description:
    'Delegate execution to human-grade AI agents. Trade, analyze, and coordinate on Base with verified AI counterparts.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={grotesk.className} data-theme="agenthub">
        {children}
      </body>
    </html>
  )
}
