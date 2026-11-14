"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { GRUPOS_DRE } from "./grupos";

const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

/** Cria ou edita uma categoria do financeiro (nome, entrada/saída e onde entra no resultado). */
export async function salvarCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: conecte o banco de dados para salvar." };
  await exigirAdmin();
  const id = texto(form, "id");
  const nome = texto(form, "nome").slice(0, 60);
  const tipo = texto(form, "tipo");
  const dre = texto(form, "dre");
  if (nome.length < 2) return { erro: "Informe o nome da categoria." };
  if (tipo !== "entrada" && tipo !== "saida") return { erro: "Escolha se é entrada ou saída." };
  if (!GRUPOS_DRE[tipo].some((g) => g.valor === dre)) return { erro: "Escolha onde ela entra no resultado (DRE)." };

  const supabase = await createClient();
  if (id) {
    const { data: atual } = await supabase.from("categorias_financeiras").select("sistema").eq("id", id).maybeSingle();
    if (!atual) return { erro: "Categoria não encontrada." };
    // Categorias do sistema (OS, faturas, taxas, compra de produtos): só o nome muda
    const dados = atual.sistema ? { nome } : { nome, tipo, dre, ativa: form.get("ativa") === "on" };
    const { error } = await supabase.from("categorias_financeiras").update(dados).eq("id", id);
    if (error) return { erro: "Não foi possível salvar a categoria." };
  } else {
    const { error } = await supabase.from("categorias_financeiras").insert({ nome, tipo, dre });
    if (error) return { erro: "Não foi possível criar a categoria." };
  }
  revalidatePath("/gestao", "layout");
  redirect(`/gestao/financeiro/categorias?salvo=${encodeURIComponent(id ? "Categoria atualizada." : "Categoria criada.")}`);
}
