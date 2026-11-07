import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sempre Zero — Garagem digital",
    short_name: "Sempre Zero",
    description: "Histórico, apontamentos, lembretes e vencimentos do seu veículo.",
    start_url: "/garagem",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
