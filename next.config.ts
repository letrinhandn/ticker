import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Only run Tailwind on globals — applying it to *.css breaks CSS Modules
      // (class names stay unhashed and leak, e.g. .tile { width: 18px } nukes the board).
      "**/globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
