/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@motoworkshop/types'],
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
