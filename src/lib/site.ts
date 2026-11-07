import "server-only";
import { headers } from "next/headers";

/** URL pública do app, usada nos links enviados por e-mail. */
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Evita redirecionar para outro site depois do login. */
export function caminhoSeguro(next: unknown, padrao = "/garagem") {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : padrao;
}
