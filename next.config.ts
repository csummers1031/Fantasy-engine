import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["playwright-core"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  headers: async () => [
    {
      source: "/api/stream",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-transform" },
        { key: "X-Accel-Buffering", value: "no" },
      ],
    },
  ],
};

export default nextConfig;
