"use client";

import { Suspense } from "react";
import ConnectInner from "./connect-page";

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6">Loading…</p>}>
      <ConnectInner />
    </Suspense>
  );
}
