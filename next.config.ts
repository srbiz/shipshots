import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Skia canvas used by the server-side render API (agents can fetch PNGs / ZIPs),
  // and the bundled ffmpeg binary used for server-side MP4 preview video rendering.
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
};

export default nextConfig;
