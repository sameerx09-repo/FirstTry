/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
      {
        source: "/seed-preview/:path*",
        destination: "http://127.0.0.1:3001/seed-preview/:path*",
      },
    ];
  },
};
