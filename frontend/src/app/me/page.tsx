import type { Metadata } from "next";
import { MeTab } from "@/components/MeTab";

export const metadata: Metadata = { title: "Inbox" };

export default function MePage() {
  return <MeTab />;
}
