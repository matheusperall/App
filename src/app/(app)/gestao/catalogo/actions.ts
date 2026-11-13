"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATEGORIAS, PORTES } from "@/lib/garagem";
import { lerDinheiro } from "@/lib/gestao";
import { createClient } from "@/lib/supabase/server";

const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

export async function salvarServicoCatalogo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return { erro: "Modo demonstração: conecte o banco de dados para salvar." };
  await exigirAdmin();
  const id = texto(form, "id");
  const nome = texto(form, "nome").slice(0, 120);
  const preco = lerDinheiro(texto(form, "preco"));
  const categoria = texto(form, "categoria");
  if (nome.length < 2) return { erro: "Informe o nome do serviço." };
  if (preco == null || preco < 0) return { erro: "Informe o preço." };
  if (!(categoria in CATEGORIAS)) return { erro: "Escolha a categoria." };

  let consumo: { produto_id: string; quantidade: number }[] = [];
  try {
    consumo = (JSON.parse(texto(form, "consumo") || "[]") as { produto_id: string; quantidade: number }[]).filter(
      (c) => c.produto_id && Number(c.quantidade) > 0,
    );
  } catch {
    return { erro: "Consumo inválido." };
  }
  // Um produto aparece uma vez só (soma as quantidades repetidas)
  const porProduto = new Map<string, number>();
  for (const c of consumo) porProduto.set(c.produto_id, (porProduto.get(c.produto_id) ?? 0) + Number(c.quantidade));

  const supabase = await createClient();
  const dados = { nome, preco, categoria, ativo: id ? form.get("ativo") === "on" : true };
  // Preço por tamanho do veículo (só os preenchidos)
  const precosPorte: Record<string, number> = {};
  for (const p of Object.keys(PORTES)) {
    const v = lerDinheiro(texto(form, `preco_${p}`));
    if (v != null && v > 0) precosPorte[p] = v;
  }
  let servicoId = id;
  if (id) {
    const { error } = await supabase.from("catalogo_servicos").update(dados).eq("id", id);
    if (error) return { erro: error.code === "23505" ? "Já existe um serviço com esse nome." : "Não foi possível salvar." };
  } else {
    const { data, error } = await supabase.from("catalogo_servicos").insert(dados).select("id").single();
    if (error || !data) return { erro: error?.code === "23505" ? "Já existe um serviço com esse nome." : "Não foi possível cadastrar." };
    servicoId = data.id;
  }

  // Preços por tamanho (0020); sem a migração, não faz nada
  await supabase.from("catalogo_servicos").update({ precos_porte: precosPorte }).eq("id", servicoId);

  await supabase.from("catalogo_consumo").delete().eq("servico_id", servicoId);
  if (porProduto.size) {
    const { error } = await supabase
      .from("catalogo_consumo")
      .insert([...porProduto].map(([produto_id, quantidade]) => ({ servico_id: servicoId, produto_id, quantidade })));
    if (error) return { erro: "Serviço salvo, mas não foi possível salvar o consumo de produtos." };
  }

  revalidatePath("/gestao", "layout");
  if (!id) redirect("/gestao/catalogo?salvo=1");
  return { sucesso: "Serviço salvo." };
}
