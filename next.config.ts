import type { NextConfig } from "next";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

// Path to an empty shim used to exclude @vercel/og from the bundle.
// The project does not use ImageResponse / OG image generation, so these
// ~2.2 MiB of WASM + JS are dead weight.
const emptyModulePath = path.resolve(__dirname, "src/lib/empty-module.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // Exclude @vercel/og (resvg.wasm, yoga.wasm, index.edge.js) from bundle
      "next/dist/compiled/@vercel/og": emptyModulePath,
    },
  },
  experimental: {
    // Tree-shake lucide-react so only imported icons are bundled
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // Webpack fallback (used when Turbopack is not active)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "next/dist/compiled/@vercel/og": emptyModulePath,
    };
    return config;
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
