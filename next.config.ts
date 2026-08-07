import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse loads pdf.worker.mjs at runtime. Keeping these packages outside
  // the server bundle preserves the worker's real path in node_modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
