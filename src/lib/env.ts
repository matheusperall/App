export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Aceita o nome antigo (anon) e o novo (publishable) que o Supabase mostra no botão "Connect"
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** true quando as variáveis do Supabase foram preenchidas */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
