import { connection } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { limparValor, supabaseAnonKey, supabaseUrl, supabaseUrlValida } from "@/lib/env";

/**
 * Diagnóstico da configuração: mostra SE as variáveis existem e o formato delas,
 * nunca os valores. Abra /status no navegador.
 */
function descrever(valor: string) {
  if (!valor) return "AUSENTE (vazia)";
  if (valor.startsWith("sb_publishable_")) return "chave publishable (sb_publishable_…)";
  if (valor.startsWith("sb_secret_")) return "chave secreta (sb_secret_…)";
  if (valor.startsWith("eyJ")) return "chave legacy (eyJ…)";
  if (valor.startsWith("http")) return "um endereço (http…)";
  if (valor.includes(".supabase.co")) return "um endereço sem https://";
  return `formato desconhecido (começa com "${valor.slice(0, 3)}…", ${valor.length} caracteres)`;
}

export async function GET() {
  await connection();
  // Com o app configurado, só o administrador vê este diagnóstico (antes disso ele ajuda a configurar)
  if (supabaseUrlValida && supabaseAnonKey) {
    const usuario = await getUsuarioAtual();
    if (usuario?.papel !== "admin") return new Response("Não encontrado", { status: 404 });
  }
  const secreta = limparValor(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const linhas: [string, string, boolean][] = [];

  const urlOk = supabaseUrlValida;
  linhas.push([
    "NEXT_PUBLIC_SUPABASE_URL",
    urlOk ? `ok (${new URL(supabaseUrl).host})` : `ERRADA: contém ${descrever(supabaseUrl)}. Deve ser https://xxxx.supabase.co`,
    urlOk,
  ]);

  const pubOk = supabaseAnonKey.startsWith("sb_publishable_") || supabaseAnonKey.startsWith("eyJ");
  linhas.push([
    "Chave pública",
    pubOk ? descrever(supabaseAnonKey) : `ERRADA: contém ${descrever(supabaseAnonKey)}. Deve começar com sb_publishable_`,
    pubOk,
  ]);

  const secOk = secreta.startsWith("sb_secret_") || secreta.startsWith("eyJ");
  linhas.push([
    "SUPABASE_SERVICE_ROLE_KEY",
    secOk ? descrever(secreta) : `ERRADA: contém ${descrever(secreta)}. Deve começar com sb_secret_`,
    secOk,
  ]);

  let conexao: [string, boolean] = ["não testada (corrija os itens acima)", false];
  if (urlOk && supabaseAnonKey) {
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey }, cache: "no-store" });
      conexao = r.ok
        ? ["OK: o Supabase aceitou a URL e a chave pública", true]
        : [`ERRO ${r.status}: o Supabase recusou a chave pública (é deste mesmo projeto?)`, false];
    } catch {
      conexao = ["ERRO: não foi possível acessar a URL do Supabase", false];
    }
  }
  linhas.push(["Conexão com o Supabase", conexao[0], conexao[1]]);

  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Status · Sempre Zero</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f6f9;color:#0b1220;margin:0;padding:24px}main{max-width:680px;margin:auto}h1{font-size:22px}
li{background:#fff;border:1px solid #e2e7ee;border-radius:12px;padding:14px 16px;margin:10px 0;list-style:none}b{display:block;margin-bottom:4px}
.ok{color:#1f9d55}.erro{color:#d93a3a}ul{padding:0}p{color:#5b6779}</style></head><body><main>
<h1>Diagnóstico da configuração</h1><p>Mostra só o formato das variáveis da Vercel, nunca os valores.</p><ul>
${linhas.map(([n, d, ok]) => `<li><b>${ok ? "✅" : "❌"} ${esc(n)}</b><span class="${ok ? "ok" : "erro"}">${esc(d)}</span></li>`).join("")}
</ul></main></body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
