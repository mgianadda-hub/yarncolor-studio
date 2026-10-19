import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // I prompt di default vengono letti da file: li includiamo esplicitamente nel bundle.
  outputFileTracingIncludes: {
    "/**": ["./config/default-prompt.txt", "./config/hex-prompt.txt"],
  },
};

export default nextConfig;
