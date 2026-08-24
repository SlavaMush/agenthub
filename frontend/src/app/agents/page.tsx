import { Suspense } from "react";
import type { Metadata } from "next";
import { AgentsTab } from "@/components/AgentsTab";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <Suspense>
      <AgentsTab />
    </Suspense>
  );
}
