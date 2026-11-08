import { NextResponse } from "next/server";
import { connection } from "next/server";
import { supabaseAnonKey, supabaseUrl, supabaseUrlValida } from "@/lib/env";

/**
 * Diagnóstico da configuração: mostra SE as variáveis existem e o formato delas,
 * nunca os valores. Abra /status no navegador.
 */
function tipoChave(chave: string | undefined) {
  const c = (chave ?? "").trim();
  if (!c) return "AUSENTE";
  if (c.startsWith("sb_publishable_")) return "publishable (sb_publishable_…)";
  if (c.startsWith("sb_secret_")) return "secreta (sb_secret_…)";
  if (c.startsWith("eyJ")) return "legacy JWT (eyJ…)";
  return "formato desconhecido";
}

export async function GET() {
  await connection();
  const secreta = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let conexao = "não testada";
  if (supabaseUrlValida && supabaseAnonKey) {
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: supabaseAnonKey },
        cache: "no-store",
      });
      conexao = r.ok ? "OK — o Supabase aceitou a chave pública" : `ERRO ${r.status} — o Supabase recusou a chave ou a URL`;
    } catch {
      conexao = "ERRO — não foi possível acessar a URL do Supabase (URL errada?)";
    }
  }

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl
      ? "AUSENTE"
      : supabaseUrlValida
        ? `ok (${new URL(supabaseUrl).host})`
        : "FORMATO INVÁLIDO — deve ser https://xxxx.supabase.co",
    chave_publica: tipoChave(supabaseAnonKey),
    nome_da_variavel_publica: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        : "nenhuma",
    SUPABASE_SERVICE_ROLE_KEY: tipoChave(secreta),
    conexao_com_supabase: conexao,
  });
}
