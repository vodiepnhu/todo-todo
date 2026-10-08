import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

const productionConfig: NextConfig = {
  ...nextConfig,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default productionConfig;
