import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@agenthub/config", "@coinbase/onchainkit"],
  serverExternalPackages: ["pino-pretty", "encoding", "lokijs"],
  outputFileTracingRoot: root,
  turbopack: {
    root,
  },
  async rewrites() {
    return [
      {
        source: "/catalog/:path*",
        destination: `${process.env.INDEXER_ORIGIN || "http://127.0.0.1:4001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
