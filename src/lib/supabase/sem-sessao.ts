import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Cliente para pedir e-mails de acesso (cadastro, recuperação de senha).
 * Usa o fluxo "implícito": o link do e-mail funciona em qualquer aparelho ou navegador
 * (o fluxo padrão "PKCE" só funciona no mesmo navegador que pediu o e-mail).
 */
export function createClienteEmail() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
