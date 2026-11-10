import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { caminhoSeguro } from "@/lib/site";

/**
 * Destino dos links enviados por e-mail (confirmação de conta, convite, recuperação de senha).
 *
 * Formatos aceitos:
 *  - ?token_hash=...&type=...   (modelo de e-mail personalizado) → confirmado aqui no servidor
 *  - ?code=...                  (fluxo PKCE)                     → confirmado aqui no servidor
 *  - #access_token=...          (convites e links "implícitos")  → a parte depois do # não chega
 *    ao servidor; o navegador mantém o # no redirecionamento e a página /auth/concluir finaliza.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = caminhoSeguro(searchParams.get("next"));
  const concluir = (extra = "") => NextResponse.redirect(`${origin}/auth/concluir?next=${encodeURIComponent(next)}${extra}`);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return concluir(`&erro=${encodeURIComponent(error.code ?? "link")}`);
    return NextResponse.redirect(`${origin}${type === "invite" || type === "recovery" ? "/redefinir-senha" : next}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return concluir(`&erro=${encodeURIComponent(error.code ?? "link")}`);
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Sem nada na URL: o acesso veio depois do # (ou o link veio com erro depois do #)
  return concluir();
}
