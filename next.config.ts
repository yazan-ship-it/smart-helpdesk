import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/** Sent with every response */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Browsers only honour this over HTTPS, so it is harmless in local development
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Nobody may put the app in a frame (clickjacking); no plugins; no <base> tricks.
        // Not for attachments: app/api/files/[id] sends a stricter sandbox policy, which this would replace.
        source: "/:path((?!api/files/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
    ];
  },
};

// Sentry uploads source maps (readable stack traces) only when SENTRY_AUTH_TOKEN,
// SENTRY_ORG and SENTRY_PROJECT are set, i.e. on the production build.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
});
