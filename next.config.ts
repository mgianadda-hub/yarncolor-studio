import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il prompt di default viene letto da file: lo includiamo esplicitamente nel bundle.
  outputFileTracingIncludes: {
    "/**": ["./config/default-prompt.txt"],
  },
};

export default nextConfig;
