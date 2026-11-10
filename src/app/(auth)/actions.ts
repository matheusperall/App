"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { traduzirErro } from "@/lib/erros";
import { createClient } from "@/lib/supabase/server";
import { createClienteEmail } from "@/lib/supabase/sem-sessao";
import { caminhoSeguro, getSiteUrl } from "@/lib/site";

export type EstadoForm = {
  erro?: string;
  sucesso?: string;
  /** Valores digitados, para não apagar o formulário quando der erro */
  valores?: Record<string, string>;
};

const NAO_CONFIGURADO: EstadoForm = {
  erro: "O banco de dados ainda não foi conectado. Veja docs/CONFIGURACAO.md.",
};

const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "").trim();

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return NAO_CONFIGURADO;
  const email = texto(form, "email").toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Preencha e-mail e senha.", valores: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: traduzirErro(error.message), valores: { email } };

  redirect(caminhoSeguro(form.get("next")));
}

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return NAO_CONFIGURADO;
  const nome = texto(form, "nome");
  const telefone = texto(form, "telefone");
  const email = texto(form, "email").toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const aceite = form.get("aceite") === "on";
  const valores = { nome, telefone, email };
  const falha = (erro: string): EstadoForm => ({ erro, valores });

  if (nome.length < 2) return falha("Informe seu nome.");
  if (!email.includes("@")) return falha("Informe um e-mail válido.");
  if (senha.length < 8) return falha("A senha deve ter pelo menos 8 caracteres.");
  if (!aceite) return falha("Para continuar, aceite os termos de uso e a política de privacidade.");

  const site = await getSiteUrl();
  const { data, error } = await createClienteEmail().auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, telefone: telefone || null },
      emailRedirectTo: `${site}/auth/confirm?next=/garagem`,
    },
  });
  if (error) {
    console.error("[cadastro]", error.status, error.code, error.message);
    return falha(traduzirErro(error.message));
  }

  // Se a confirmação de e-mail estiver desligada, já entra direto (grava a sessão nos cookies).
  if (data.session) {
    const supabase = await createClient();
    await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    redirect("/garagem");
  }

  return {
    sucesso: `Conta criada! Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar sua conta.`,
  };
}

export async function recuperarSenha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return NAO_CONFIGURADO;
  const email = texto(form, "email").toLowerCase();
  if (!email.includes("@")) return { erro: "Informe um e-mail válido." };

  const site = await getSiteUrl();
  const { error } = await createClienteEmail().auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/confirm?next=/redefinir-senha`,
  });
  if (error) return { erro: traduzirErro(error.message) };

  // Mesma resposta exista ou não a conta (não revela quem é cliente).
  return {
    sucesso: "Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha.",
  };
}

export async function redefinirSenha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return NAO_CONFIGURADO;
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  if (senha.length < 8) return { erro: "A senha deve ter pelo menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "As senhas não conferem." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { erro: "O link expirou. Peça um novo em “Esqueci minha senha”." };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: traduzirErro(error.message) };

  redirect("/garagem?senha=ok");
}

export async function sair() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/entrar");
}
