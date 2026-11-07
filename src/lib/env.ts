export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** true quando as variáveis do Supabase foram preenchidas */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
