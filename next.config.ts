import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // This app lives beside the Nuxt project; pin the root to avoid lockfile ambiguity.
  turbopack: { root: __dirname },
  experimental: {
    // Turbopack runs PostCSS in separate Node processes that must connect
    // back over 127.0.0.1. The host's build runner blocks that, so the build
    // dies on the first CSS file ("node process exited before we could
    // connect to it"). Threads run inside the build process instead.
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.qshot.com" },
      { protocol: "https", hostname: "qshottest.s3.us-east-2.amazonaws.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
