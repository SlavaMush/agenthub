/** Decode ERC-8004 tokenURI into a display name + description. */
export type AgentProfile = { name?: string; description?: string };

function decodeBase64Json(b64: string): AgentProfile {
  const binary = atob(b64);
  const json = decodeURIComponent(escape(binary));
  return JSON.parse(json) as AgentProfile;
}

export function parseAgentTokenUri(uri: string): AgentProfile | null {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const json = decodeBase64Json(uri.slice("data:application/json;base64,".length));
      return { name: json.name, description: json.description };
    }
    if (uri.startsWith("data:application/json,")) {
      const json = JSON.parse(decodeURIComponent(uri.slice("data:application/json,".length))) as AgentProfile;
      return { name: json.name, description: json.description };
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchAgentProfileFromUri(uri: string): Promise<AgentProfile | null> {
  const inline = parseAgentTokenUri(uri);
  if (inline) return inline;
  if (!uri.startsWith("http://") && !uri.startsWith("https://")) return null;
  const r = await fetch(uri);
  if (!r.ok) return null;
  const json = (await r.json()) as AgentProfile;
  return { name: json.name, description: json.description };
}
