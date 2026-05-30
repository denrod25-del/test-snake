import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    /** Pin workspace root when parent folders have stray lockfiles */
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
