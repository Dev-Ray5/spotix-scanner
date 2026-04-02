const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@vladmandic/face-api': require.resolve(
        '@vladmandic/face-api/dist/face-api.esm.js'
      ),
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      os: false,
      encoding: false,
    };

    // Suppress face-api dynamic require warnings cos i don't like it
    config.module.exprContextCritical = false;

    return config;
  },
};
module.exports = nextConfig;