/**
 * Limpa valores colados com sobras comuns:
 * espaços, aspas e o próprio nome da variável ("NOME=valor", como aparece no .env.local).
 */
export function limparValor(v: string | undefined) {
  let s = (v ?? "").trim();
  s = s.replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, "");
  s = s.replace(/^["']|["']$/g, "").trim();
  return s;
}

export const supabaseUrl = limparValor(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
// Aceita o nome antigo (anon) e o novo (publishable) que o Supabase mostra no botão "Connect"
export const supabaseAnonKey = limparValor(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** A URL precisa ser algo como https://xxxx.supabase.co */
export const supabaseUrlValida = /^https:\/\/[^\s/]+$/.test(supabaseUrl);

/** true quando as variáveis do Supabase foram preenchidas corretamente */
export const isSupabaseConfigured = Boolean(supabaseUrlValida && supabaseAnonKey);
