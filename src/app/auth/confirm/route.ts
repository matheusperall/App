import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { caminhoSeguro } from "@/lib/site";

/**
 * Destino dos links enviados por e-mail (confirmação de conta, convite,
 * recuperação de senha). Aceita os dois formatos do Supabase:
 * ?token_hash=...&type=...  ou  ?code=...
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = caminhoSeguro(searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) return NextResponse.redirect(`${origin}/entrar?erro=link`);

  // Convite e recuperação: a pessoa precisa definir uma senha.
  const destino = type === "invite" || type === "recovery" ? "/redefinir-senha" : next;
  return NextResponse.redirect(`${origin}${destino}`);
}
