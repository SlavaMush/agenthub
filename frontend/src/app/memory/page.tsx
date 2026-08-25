import { Suspense } from "react";
import type { Metadata } from "next";
import { MemoryTab } from "@/components/MemoryTab";

export const metadata: Metadata = { title: "Memory" };

export default function MemoryPage() {
  return (
    <Suspense>
      <MemoryTab />
    </Suspense>
  );
}
