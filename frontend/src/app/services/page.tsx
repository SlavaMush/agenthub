import { Suspense } from "react";
import type { Metadata } from "next";
import { ServicesTab } from "@/components/ServicesTab";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <Suspense>
      <ServicesTab />
    </Suspense>
  );
}
