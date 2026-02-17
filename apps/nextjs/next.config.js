const { readFileSync } = require('fs');

// Read version from mounted/copied VERSION file
let appVersion = '0.0.0';
try {
  appVersion = readFileSync('/etc/app-version', 'utf-8').trim();
} catch {
  try {
    // Fallback: check project root (for local dev without Docker)
    appVersion = readFileSync(require('path').resolve(__dirname, '../../VERSION'), 'utf-8').trim();
  } catch { /* use default */ }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  generateBuildId: () => appVersion,
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async redirects() {
    return [
      {
        source: '/blogs',
        destination: '/my/blogs',
        permanent: true,
      },
      {
        source: '/blogs/:id',
        destination: '/my/blogs/:id',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig
