import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Cliente com a chave service_role: ignora as regras de segurança do banco.
 * Use SOMENTE no servidor e SOMENTE depois de confirmar que quem pediu é admin.
 * A chave fica apenas nas variáveis de ambiente do servidor (Vercel), nunca no navegador.
 */
export function createAdminClient() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !chave) return null;
  return createClient(supabaseUrl, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
