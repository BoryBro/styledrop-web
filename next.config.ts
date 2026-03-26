import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Next.js 16 types might not include allowedDevOrigins on the root yet, but it's required for local network dev
  allowedDevOrigins: ['192.168.219.102', '192.168.219.102:3000'],
};

export default nextConfig;
