/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function traduzirErro(message: string | undefined): string {
  const original = message ?? "";
  const m = original.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 8 caracteres.";
  if (m.includes("weak") && m.includes("password")) return "Senha fraca. Use letras e números.";
  if (m.includes("rate limit") || m.includes("security purposes"))
    return "Limite de e-mails atingido no momento. Aguarde alguns minutos e tente novamente.";
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha deve ser diferente da anterior.";
  if (m.includes("not authorized") && m.includes("email"))
    return "O envio de e-mail para este endereço não está liberado (servidor de e-mail padrão do Supabase). Detalhe: " + original;
  if (m.includes("sending") && m.includes("email"))
    return "Não foi possível enviar o e-mail de confirmação. Detalhe: " + original;
  if (m.includes("database error")) return "Erro no banco de dados ao criar a conta. Detalhe: " + original;
  if (m.includes("invalid api key") || m.includes("no api key"))
    return "Chave do Supabase inválida na Vercel. Confira as variáveis de ambiente.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "Novos cadastros estão desativados no Supabase (Authentication > Sign In / Providers).";
  if (m.includes("invalid email") || m.includes("unable to validate email") || m.includes("is invalid"))
    return "E-mail inválido. Detalhe: " + original;
  if (m.includes("expired") || (m.includes("invalid") && m.includes("token"))) return "O link expirou ou é inválido. Peça um novo.";
  return original ? `Algo deu errado: ${original}` : "Algo deu errado. Tente novamente.";
}
