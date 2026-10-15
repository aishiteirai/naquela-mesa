import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Rotas antigas do painel (antes do cardápio em tela única).
  async redirects() {
    return [
      { source: "/painel/disponibilidade", destination: "/painel/cardapio", permanent: false },
      {
        source: "/painel/cardapio/produtos/novo",
        has: [{ type: "query", key: "categoria", value: "(?<categoria>[^&]+)" }],
        destination: "/painel/cardapio?novo=:categoria",
        permanent: false,
      },
      { source: "/painel/cardapio/produtos/novo", destination: "/painel/cardapio", permanent: false },
      { source: "/painel/cardapio/produtos/:id", destination: "/painel/cardapio?produto=:id", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/convite/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
