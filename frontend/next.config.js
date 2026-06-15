/** @type {import('next').NextConfig} */
function resolveBackendUrl() {
  const configured = process.env.BACKEND_URL?.trim();

  if (!configured) {
    return process.env.NODE_ENV === "development" ? "http://localhost:8001" : "";
  }

  // `backend` only resolves inside the Docker Compose network. For local `npm run dev`,
  // fall back to localhost so rewrites keep working without Docker.
  if (process.env.NODE_ENV === "development" && configured.includes("://backend:")) {
    return configured.replace("://backend:", "://localhost:");
  }

  return configured;
}

const nextConfig = {
  experimental: {
    proxyClientMaxBodySize: "2048mb",
  },
  async rewrites() {
    const backendUrl = resolveBackendUrl();

    if (!backendUrl) {
      console.warn("[next] BACKEND_URL is not set; API rewrites are disabled.");
      return [];
    }

    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/auth/:path*", destination: `${backendUrl}/auth/:path*` },
      { source: "/clips/:path*", destination: `${backendUrl}/clips/:path*` },
    ];
  },
};

module.exports = nextConfig;
