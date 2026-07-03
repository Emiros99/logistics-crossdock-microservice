import type { NextConfig } from 'next';

/**
 * Next.js konfiguráció.
 *
 * `output: 'standalone'` — a Docker image-be csak a ténylegesen használt
 * függőségek kerülnek be (tree-shaken node_modules), így a futtatható
 * artefakt lényegesen kisebb és a `frontend` compose-service belépési
 * pontja egyszerűen `node server.js`. A DevOps kollégák erre építenek.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
