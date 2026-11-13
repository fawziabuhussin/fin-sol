import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  // Never allow the app to be framed (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A stray lockfile in a parent folder makes Turbopack treat it as the
  // workspace root (and crawl it). Pin the root to this project.
  turbopack: { root: path.resolve(__dirname) },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Financial data must never be cached by shared proxies.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
