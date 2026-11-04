// Next loads next.config.mjs first. Keep one canonical runtime configuration.
import type { NextConfig } from "next";
import nextConfig from "./next.config.mjs";
export default nextConfig satisfies NextConfig;
