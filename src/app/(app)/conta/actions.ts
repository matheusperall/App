"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { EstadoForm } from "@/app/(auth)/actions";

export async function atualizarPerfil(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Banco de dados ainda não conectado." };
  const nome = String(form.get("nome") ?? "").trim();
  const telefone = String(form.get("telefone") ?? "").trim();
  if (nome.length < 2) return { erro: "Informe seu nome." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { erro: "Sua sessão expirou. Entre novamente." };

  const { error } = await supabase
    .from("perfis")
    .update({ nome, telefone: telefone || null })
    .eq("id", id);
  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/", "layout");
  return { sucesso: "Dados atualizados." };
}
