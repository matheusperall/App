import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Papel = "cliente" | "admin";

export type UsuarioAtual = {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
  papel: Papel;
};

const USUARIO_DEMO: UsuarioAtual = {
  id: "demo",
  email: "demo@semprezero.app",
  nome: "Cliente Demonstração",
  telefone: null,
  // Modo demonstração: DEMO_PAPEL=cliente mostra as telas como o cliente vê
  papel: process.env.DEMO_PAPEL === "cliente" ? "cliente" : "admin",
};

/** Usuário logado, ou null. Lê a sessão (dado de requisição). */
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  // Conteúdo por usuário: sempre renderizado na hora da requisição.
  await connection();
  // Sem banco conectado: usuário de demonstração, para visualizar as telas.
  if (!isSupabaseConfigured) return USUARIO_DEMO;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, telefone, papel")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    nome: perfil?.nome ?? "",
    telefone: perfil?.telefone ?? null,
    papel: (perfil?.papel as Papel | undefined) ?? "cliente",
  };
}

/** Exige login; caso contrário manda para /entrar. */
export async function exigirUsuario(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/entrar");
  return usuario;
}

/** Exige que o usuário seja administrador. */
export async function exigirAdmin(): Promise<UsuarioAtual> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "admin") redirect("/garagem");
  return usuario;
}

export function primeiroNome(nome: string, email: string) {
  const n = nome.trim().split(/\s+/)[0];
  return n || email.split("@")[0];
}
