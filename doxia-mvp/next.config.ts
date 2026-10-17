import type { NextConfig } from "next";
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
const nextConfig: NextConfig = {
  async headers() {
    return [
      // The app itself must never be framed.
      { source: "/((?!embed/).*)", headers: [...baseHeaders, { key: "X-Frame-Options", value: "DENY" }] },
      // Embeds are read-only public widgets designed to be framed by other sites.
      { source: "/embed/:path*", headers: [...baseHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
};
export default nextConfig;
