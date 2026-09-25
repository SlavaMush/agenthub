"use client";

import { useEffect } from "react";
import { Button, Logo } from "@/components/ui";

// Any render/effect crash lands here instead of the browser's blank "couldn't load" page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="bg-grid grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 text-center">
        <div className="flex justify-center"><Logo /></div>
        <p className="mt-6 text-xl font-semibold">Something went wrong on this page</p>
        <p className="mt-2 text-sm text-dim">
          Your wallet and anything you already signed are safe: signatures and trades are recorded on-chain, not in this page.
        </p>
        <p className="mt-3 break-words rounded-lg bg-bg p-2 font-mono text-xs text-mute">{error.message || "Unknown error"}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="ghost" onClick={() => location.reload()}>Reload</Button>
        </div>
      </div>
    </main>
  );
}
