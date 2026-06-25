import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@motoworkshop/types'],
};

// withSentryConfig wires the client config into the browser bundle. Source map
// upload is skipped unless SENTRY_AUTH_TOKEN is set (runtime error capture works
// regardless).
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
