import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "127.0.0.1:3001", "192.168.219.102", "192.168.219.102:3000"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "styledrop.cloud",
          },
        ],
        destination: "https://www.styledrop.cloud/:path*",
        permanent: true,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
