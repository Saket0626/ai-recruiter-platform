import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "@azure/msal-node",
    "cheerio",
    "unpdf",
  ],
};

export default nextConfig;
