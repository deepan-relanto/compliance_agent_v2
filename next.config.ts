import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Allow JS worker for pdf.js
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  // Allow large PDF/PPT uploads and video uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    middlewareClientMaxBodySize: "100mb",
  },
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config, { dev }) => {
    // Required for react-pdf / pdfjs-dist to load the PDF worker correctly
    config.resolve.alias.canvas = false;

    if (dev) {
      // OneDrive can delay file events — polling keeps dev bundles fresh
      // but ignoring heavy dirs dramatically reduces watch overhead
      config.watchOptions = {
        poll: 1500,
        aggregateTimeout: 400,
        ignored: [
          "**/node_modules/**",
          "**/.next/**",
          "**/public/uploads/**",
          "**/public/course-assets/**",
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
