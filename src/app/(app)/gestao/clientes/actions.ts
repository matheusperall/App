"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

/** Cadastra ou edita a ficha do cliente na loja (não precisa de e-mail nem de conta no app). */
export async function salvarFicha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const nome = texto(form, "nome").slice(0, 120);
  const email = texto(form, "email").toLowerCase() || null;
  if (nome.length < 2) return { erro: "Informe o nome do cliente." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "E-mail inválido." };
  const dados = {
    nome,
    telefone: texto(form, "telefone") || null,
    email,
    lojista: form.get("lojista") === "on",
    observacoes: texto(form, "observacoes").slice(0, 2000) || null,
  };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("clientes").update(dados).eq("id", id);
    if (error) return { erro: "Não foi possível salvar." };
    revalidatePath("/gestao", "layout");
    return { sucesso: "Dados salvos." };
  }
  const { data, error } = await supabase.from("clientes").insert(dados).select("id").single();
  if (error || !data) return { erro: "Não foi possível cadastrar o cliente." };

  let aviso = "";
  if (form.get("convidar") === "on") {
    if (!email) aviso = "&aviso=sem-email";
    else {
      const r = await convidar(data.id, email, nome, dados.telefone);
      if (r.erro) aviso = `&aviso=${encodeURIComponent(r.erro)}`;
    }
  }
  revalidatePath("/gestao", "layout");
  redirect(`/gestao/clientes/${data.id}?novo=1${aviso}`);
}

/**
 * Dá acesso ao app para um cliente que só tinha ficha na loja.
 * Se já existe conta com o e-mail, liga a ficha a ela; senão envia o convite por e-mail.
 * Os veículos da ficha passam a aparecer na garagem do cliente, sem duplicar nada.
 */
async function convidar(fichaId: string, email: string, nome: string, telefone: string | null): Promise<EstadoForm> {
  const admin = createAdminClient();
  if (!admin) return { erro: "Falta configurar a chave SUPABASE_SERVICE_ROLE_KEY no servidor (veja docs/CONFIGURACAO.md)." };

  const { data: existente } = await admin.from("perfis").select("id, papel").ilike("email", email).maybeSingle();
  let perfilId = existente?.id as string | undefined;
  if (existente?.papel === "admin") return { erro: "Este e-mail é de um administrador." };
  if (!perfilId) {
    const site = await getSiteUrl();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, telefone },
      redirectTo: `${site}/auth/confirm?next=/redefinir-senha`,
    });
    if (error || !data.user) {
      const m = (error?.message ?? "").toLowerCase();
      if (m.includes("rate") || m.includes("security purposes")) return { erro: "Limite de e-mails atingido. Aguarde alguns minutos e tente de novo." };
      return { erro: `Não foi possível enviar o convite${error ? `: ${error.message}` : ""}.` };
    }
    perfilId = data.user.id;
  }
  const { error } = await admin.rpc("vincular_cliente_perfil", { p_cliente: fichaId, p_perfil: perfilId });
  if (error) {
    console.error("[clientes] vincular", error);
    return { erro: `Não foi possível ligar a ficha à conta: ${error.message}` };
  }
  return { sucesso: existente ? "Este e-mail já tinha conta no app: a ficha foi ligada a ela." : `Convite enviado para ${email}.` };
}

export async function convidarFicha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const supabase = await createClient();
  const { data: f } = await supabase.from("clientes").select("id, nome, telefone, email, perfil_id").eq("id", texto(form, "id")).maybeSingle();
  if (!f) return { erro: "Cliente não encontrado." };
  if (f.perfil_id) return { erro: "Este cliente já tem acesso ao app." };
  const email = (texto(form, "email") || f.email || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe um e-mail válido." };
  if (email !== f.email) await supabase.from("clientes").update({ email }).eq("id", f.id);
  const r = await convidar(f.id, email, f.nome, f.telefone);
  revalidatePath("/gestao", "layout");
  return r;
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
