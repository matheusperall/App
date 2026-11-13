"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { MODELOS, ehChaveMensagem } from "@/lib/mensagens";
import { createClient } from "@/lib/supabase/server";

/** Salva (ou volta ao padrão) o modelo de uma mensagem de WhatsApp. */
export async function salvarModeloMensagem(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: conecte o banco de dados para salvar." };
  await exigirAdmin();
  const chave = String(form.get("chave") ?? "");
  if (!ehChaveMensagem(chave)) return { erro: "Mensagem desconhecida." };
  const restaurar = form.get("restaurar") === "sim";
  const texto = String(form.get("texto") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 3000);
  if (!restaurar && !texto) return { erro: "Escreva o texto da mensagem (ou toque em Voltar ao padrão)." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("gestao_config").select("mensagens").maybeSingle();
  if (error) {
    return { erro: error.code === "42703" ? "O banco ainda não recebeu o arquivo 0018 (modelos de mensagens). Rode-o no Supabase." : "Não foi possível salvar. Tente novamente." };
  }
  const atuais = { ...((data?.mensagens as Record<string, string> | null) ?? {}) };
  if (restaurar || texto === MODELOS[chave].padrao) delete atuais[chave];
  else atuais[chave] = texto;
  const { error: e2 } = await supabase.from("gestao_config").update({ mensagens: atuais }).eq("id", true);
  if (e2) return { erro: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/gestao/mensagens");
  return { sucesso: restaurar ? "Voltou ao texto padrão." : "Modelo salvo." };
}
