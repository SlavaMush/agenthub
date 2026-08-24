/** ERC-8004 agentURI helpers. The registry stores a string; it must resolve to JSON. */

export type AgentRegistration = {
  type: string;
  name: string;
  description: string;
  image?: string;
  active: boolean;
  services: Array<{ name: string; endpoint: string; version?: string }>;
};

export const AGENT_REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

export function utf8ToBase64(value: string) {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, "utf8").toString("base64");
}

export function buildAgentRegistration(input: {
  name: string;
  description: string;
  image?: string;
  endpoint?: string;
}): AgentRegistration {
  const services = input.endpoint?.trim()
    ? [{ name: "web", endpoint: input.endpoint.trim() }]
    : [];
  return {
    type: AGENT_REGISTRATION_TYPE,
    name: input.name.trim() || "Unnamed agent",
    description: input.description.trim() || "AgentHub listing",
    image: input.image?.trim() || undefined,
    active: true,
    services,
  };
}

export function buildAgentUri(input: {
  name: string;
  description: string;
  image?: string;
  endpoint?: string;
}) {
  const json = JSON.stringify(buildAgentRegistration(input));
  return `data:application/json;base64,${utf8ToBase64(json)}`;
}

export function isHostedUri(value: string) {
  return /^(ipfs:\/\/|https:\/\/|http:\/\/|data:)/i.test(value.trim());
}

export function buildServiceUri(title: string, brief: string, specUri = "") {
  if (specUri.trim()) return specUri.trim();
  const url = new URL("agenthub://service");
  if (title.trim()) url.searchParams.set("title", title.trim());
  if (brief.trim()) url.searchParams.set("brief", brief.trim());
  return url.toString();
}

export function buildMemoryUri(cid: string, title = "", hostedUri = "") {
  if (hostedUri.trim()) return hostedUri.trim();
  const base = cid.startsWith("ipfs://") ? cid : `ipfs://${cid}`;
  if (!title.trim()) return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}title=${encodeURIComponent(title.trim())}`;
}

export function parseListingUri(uri: string) {
  if (!uri) return { title: "", brief: "", category: "" };
  try {
    const url = new URL(uri);
    return {
      title: url.searchParams.get("title") || "",
      brief: url.searchParams.get("brief") || "",
      category: url.searchParams.get("category") || "",
    };
  } catch {
    return { title: "", brief: "", category: "" };
  }
}
