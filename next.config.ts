import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // This app lives beside the Nuxt project; pin the root to avoid lockfile ambiguity.
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.qshot.com" },
      { protocol: "https", hostname: "qshottest.s3.us-east-2.amazonaws.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
