import { ServiceItem } from "@/components/ServiceItem";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceItem id={id} />;
}
