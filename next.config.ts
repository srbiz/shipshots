import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Skia canvas used by the server-side render API (agents can fetch PNGs / ZIPs).
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
