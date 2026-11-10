"use server";

import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** A empresa cadastra um cliente; ele recebe um e-mail de convite para criar a senha. */
export async function cadastrarCliente(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: conecte o banco de dados para salvar." };
  await exigirAdmin();

  const nome = String(form.get("nome") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const telefone = String(form.get("telefone") ?? "").trim() || null;
  if (nome.length < 2) return { erro: "Informe o nome do cliente." };
  if (!email.includes("@")) return { erro: "Informe um e-mail válido." };

  // Já existe?
  const supabase = await createClient();
  const { data: existente } = await supabase.from("perfis").select("id").eq("email", email).maybeSingle();
  if (existente) redirect(`/painel/clientes/${existente.id}?existente=1`);

  const admin = createAdminClient();
  if (!admin) {
    return { erro: "Falta configurar a chave SUPABASE_SERVICE_ROLE_KEY no servidor (veja docs/CONFIGURACAO.md)." };
  }

  const site = await getSiteUrl();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome, telefone },
    redirectTo: `${site}/auth/confirm?next=/redefinir-senha`,
  });
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes("already")) return { erro: "Já existe uma conta com este e-mail." };
    return { erro: "Não foi possível cadastrar o cliente. Tente novamente." };
  }

  redirect(`/painel/clientes/${data.user.id}?novo=1`);
}

/**
 * Reenvia o acesso ao cliente: novo convite (se ainda não aceitou) ou link para criar uma nova senha.
 * Útil quando o convite expirou (os links valem por tempo limitado).
 */
export async function reenviarAcesso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração." };
  await exigirAdmin();
  const admin = createAdminClient();
  if (!admin) return { erro: "Falta configurar a chave SUPABASE_SERVICE_ROLE_KEY no servidor." };

  const id = String(form.get("cliente_id") ?? "");
  const { data: perfil } = await admin.from("perfis").select("email, nome").eq("id", id).maybeSingle();
  if (!perfil?.email) return { erro: "Cliente sem e-mail cadastrado." };

  const site = await getSiteUrl();
  const destino = `${site}/auth/confirm?next=/redefinir-senha`;
  const { data: usuario } = await admin.auth.admin.getUserById(id);
  const aceitou = Boolean(usuario.user?.email_confirmed_at || usuario.user?.last_sign_in_at);

  const { error } = aceitou
    ? await admin.auth.resetPasswordForEmail(perfil.email, { redirectTo: destino })
    : await admin.auth.admin.inviteUserByEmail(perfil.email, { redirectTo: destino, data: { nome: perfil.nome } });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("rate") || m.includes("security purposes")) return { erro: "Limite de e-mails atingido. Aguarde alguns minutos e tente de novo." };
    return { erro: `Não foi possível reenviar: ${error.message}` };
  }
  return {
    sucesso: aceitou
      ? `Enviamos para ${perfil.email} um link para criar uma nova senha.`
      : `Convite reenviado para ${perfil.email}.`,
  };
}
