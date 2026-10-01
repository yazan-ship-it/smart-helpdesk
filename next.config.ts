import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // User-uploaded attachments: stop browsers from sniffing a file into a type
        // other than its (allowlisted) extension, e.g. treating a .txt as HTML
        source: "/uploads/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
