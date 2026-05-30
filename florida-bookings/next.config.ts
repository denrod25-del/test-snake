import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/client", "prisma"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
