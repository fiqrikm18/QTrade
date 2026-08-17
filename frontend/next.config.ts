import type { NextConfig } from "next";

const API_UPSTREAM = process.env.API_UPSTREAM ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_UPSTREAM}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;