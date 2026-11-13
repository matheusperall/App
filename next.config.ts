import type { NextConfig } from "next";

/** Cabeçalhos de segurança em todas as páginas. */
const CABECALHOS_SEGURANCA = [
  // Impede que o app seja aberto dentro de outro site (golpe de "clique escondido")
  { key: "X-Frame-Options", value: "DENY" },
  // O navegador não tenta "adivinhar" o tipo dos arquivos
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Links para outros sites não levam o endereço completo da página
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Sempre HTTPS
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // O app não usa microfone nem localização
  { key: "Permissions-Policy", value: "microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:caminho*", headers: CABECALHOS_SEGURANCA }];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
