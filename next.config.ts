import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The reverse proxy (Caddy) terminates TLS and forwards X-Forwarded-* headers.
  // Trusting them allows Auth.js to build correct callback URLs in production.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "inbox-atlas.particle-retention.cloud",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
