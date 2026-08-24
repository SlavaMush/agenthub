import { MemoryItem } from "@/components/MemoryItem";

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemoryItem id={id} />;
}
