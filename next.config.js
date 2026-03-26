const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tanstack/react-query", "@react-pdf/renderer"],
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = withBundleAnalyzer(nextConfig);
