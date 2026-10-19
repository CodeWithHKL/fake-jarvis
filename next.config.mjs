/** @type {import("next").NextConfig} */
const nextConfig = {
  // Pin the project root (there is another lockfile higher up on this machine).
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
