/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function traduzirErro(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 8 caracteres.";
  if (m.includes("weak") && m.includes("password")) return "Senha fraca. Use letras e números.";
  if (m.includes("rate limit") || m.includes("security purposes")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha deve ser diferente da anterior.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "E-mail inválido.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "O link expirou ou é inválido. Peça um novo.";
  return "Algo deu errado. Tente novamente.";
}
