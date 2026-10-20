import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // The in-app guide reads these at request time (src/lib/helpGuide.ts)
  outputFileTracingIncludes: {
    '/dashboard/help': ['./docs/sales/kb-bot/*.md'],
  },
};

export default nextConfig;
