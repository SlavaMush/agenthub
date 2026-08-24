/** Parse AgentHub listing URIs (agenthub://, ipfs://?title=) into display fields. */

export function parseListingMeta(uriOrCid) {
  if (!uriOrCid) return { title: "", brief: "", category: "" };
  try {
    const url = new URL(uriOrCid);
    return {
      title: url.searchParams.get("title") || "",
      brief: url.searchParams.get("brief") || "",
      category: url.searchParams.get("category") || "",
    };
  } catch {
    return { title: "", brief: "", category: "" };
  }
}

export function withListingMeta(item, source) {
  const meta = parseListingMeta(source);
  return {
    ...item,
    title: item.title || meta.title,
    brief: item.brief || meta.brief,
    category: item.category || meta.category,
  };
}
