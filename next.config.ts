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
    ];
  },
  // Allow large PPT/PPTX uploads (service enforces 50 MB; give a 5 MB buffer here)
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config, { dev }) => {
    // Required for react-pdf / pdfjs-dist to load the PDF worker correctly
    config.resolve.alias.canvas = false;

    // OneDrive can delay file events; polling avoids stale/corrupt dev bundles
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    return config;
  },
};

export default nextConfig;
