import type { NextConfig } from "next";

// turbopack.root must be the monorepo root (the directory CONTAINING the
// project), not the project directory itself. Without it, Turbopack picks up
// an unrelated pnpm-lock.yaml at /home/coder/ and sets the wrong workspace
// root, causing CSS @import "tailwindcss" to fail to resolve.
//
// We compute this with pure globals (no imports) to avoid the ESM/CJS
// compilation conflict that occurs in next.config.ts when package.json has
// "type": "module". process.cwd() is the dashboard dir when `next dev` runs;
// going up 2 levels reaches the monorepo root (pve-home-lab/).
const monorepoRoot = process.cwd().split("/").slice(0, -2).join("/");

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
