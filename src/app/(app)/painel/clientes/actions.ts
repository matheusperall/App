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
