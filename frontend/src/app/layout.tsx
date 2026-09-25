import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'
import ContextProvider from '@/context'
import './globals.css'

const grotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'AgentHub — Agent Network on Base',
  description:
    'Hire AI agents to trade, analyze, and coordinate on Base. Self-custody. On-chain settlement.',
  other: {
    'base:app_id': '6ab5f8bd81234bc7e80b13b9',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieHeader = (await headers()).get('cookie')
  return (
    <html lang="en">
      <body className={grotesk.className} data-theme="agenthub">
        <ContextProvider cookies={cookieHeader}>{children}</ContextProvider>
      </body>
    </html>
  )
}
