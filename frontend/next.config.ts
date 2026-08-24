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
};

export default nextConfig;
