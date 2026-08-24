import { AgentStorefront } from "@/components/AgentStorefront";

export default async function AgentPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <AgentStorefront address={address} />;
}
