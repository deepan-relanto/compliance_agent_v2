import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large PPT/PPTX uploads (service enforces 50 MB; give a 5 MB buffer here)
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config) => {
    // Required for react-pdf / pdfjs-dist to load the PDF worker correctly
    config.resolve.alias.canvas = false;

    return config;
  },
};

export default nextConfig;
