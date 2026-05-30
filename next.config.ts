import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large PPT/PPTX uploads (service enforces 50 MB; give a 5 MB buffer here)
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config, { dev, isServer }) => {
    // Required for react-pdf / pdfjs-dist to load the PDF worker correctly
    config.resolve.alias.canvas = false;

    // FIX: "Object.defineProperty called on non-object" with pdfjs-dist v5
    // ─────────────────────────────────────────────────────────────────────
    // Next.js 15 dev mode defaults to `eval-source-map` devtool, which wraps
    // every module in eval("…"). Inside strict-mode eval, the synthetic
    // `exports` object webpack injects is null.  When pdfjs-dist/build/pdf.mjs
    // calls Object.defineProperty(exports, …) at module scope it crashes.
    //
    // Switching to `cheap-module-source-map` provides equivalent source maps
    // WITHOUT the eval() wrapper, so pdfjs-dist initializes cleanly.
    // Production builds are unaffected (they already use a non-eval devtool).
    if (dev && !isServer) {
      config.devtool = "cheap-module-source-map";
    }

    return config;
  },
};

export default nextConfig;
