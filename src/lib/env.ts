// .trim(): ignora espaços ou quebras de linha coladas sem querer junto com a chave
export const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
// Aceita o nome antigo (anon) e o novo (publishable) que o Supabase mostra no botão "Connect"
export const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

/** A URL precisa ser algo como https://xxxx.supabase.co */
export const supabaseUrlValida = /^https:\/\/[^\s/]+$/.test(supabaseUrl);

/** true quando as variáveis do Supabase foram preenchidas corretamente */
export const isSupabaseConfigured = Boolean(supabaseUrlValida && supabaseAnonKey);
