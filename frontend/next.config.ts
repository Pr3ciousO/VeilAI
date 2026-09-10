import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared workspace package ships ESM; let Next transpile it.
  transpilePackages: ["@veilai/shared"],
};

export default nextConfig;
