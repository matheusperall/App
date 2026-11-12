"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { UNIDADES, lerDinheiro, lerNumero } from "@/lib/gestao";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

export async function salvarProduto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const nome = texto(form, "nome").slice(0, 120);
  const unidade = texto(form, "unidade");
  const minimo = lerNumero(texto(form, "minimo")) ?? 0;
  if (nome.length < 2) return { erro: "Informe o nome do produto." };
  if (!(unidade in UNIDADES)) return { erro: "Escolha a unidade." };
  if (minimo < 0) return { erro: "O estoque mínimo não pode ser negativo." };
  const supabase = await createClient();
  const dados = { nome, unidade, minimo, ativo: id ? form.get("ativo") === "on" : true };

  if (id) {
    const { error } = await supabase.from("produtos").update(dados).eq("id", id);
    if (error) return { erro: error.code === "23505" ? "Já existe um produto com esse nome." : "Não foi possível salvar." };
    revalidatePath("/gestao", "layout");
    return { sucesso: "Produto atualizado." };
  }

  const { data, error } = await supabase.from("produtos").insert(dados).select("id").single();
  if (error || !data) return { erro: error?.code === "23505" ? "Já existe um produto com esse nome." : "Não foi possível cadastrar." };

  // Saldo inicial entra como reposição (já calcula o custo médio)
  const qtd = lerNumero(texto(form, "saldo_inicial"));
  const valor = lerDinheiro(texto(form, "valor_inicial")) ?? 0;
  if (qtd && qtd > 0) {
    await supabase.rpc("gestao_repor_produto", { p_produto: data.id, p_quantidade: qtd, p_custo_total: Math.max(0, valor), p_lancar: false });
  }
  revalidatePath("/gestao", "layout");
  redirect(`/gestao/estoque/${data.id}`);
}

/** Compra/reposição: soma ao saldo, recalcula o custo médio e (se pedir) lança a saída no financeiro. */
export async function reporProduto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const qtd = lerNumero(texto(form, "quantidade"));
  const valor = lerDinheiro(texto(form, "valor"));
  if (!qtd || qtd <= 0) return { erro: "Informe a quantidade comprada." };
  if (valor == null || valor < 0) return { erro: "Informe quanto pagou no total." };
  const lancar = form.get("lancar") === "on";
  const pago = texto(form, "pago") !== "nao";
  const vencimento = texto(form, "vencimento") || null;
  const conta = texto(form, "conta_id") || null;
  if (lancar && !pago && !vencimento) return { erro: "Informe o vencimento da conta a pagar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("gestao_repor_produto", {
    p_produto: texto(form, "id"),
    p_quantidade: qtd,
    p_custo_total: valor,
    p_lancar: lancar,
    p_conta: conta,
    p_pago: pago,
    p_vencimento: vencimento,
  });
  if (error) {
    console.error("[estoque] repor", error);
    return { erro: "Não foi possível registrar a reposição." };
  }
  revalidatePath("/gestao", "layout");
  return { sucesso: lancar ? "Reposição registrada e lançada no financeiro." : "Reposição registrada." };
}

export async function ajustarProduto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const saldo = lerNumero(texto(form, "saldo"));
  if (saldo == null) return { erro: "Informe o saldo contado." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("gestao_ajustar_produto", { p_produto: texto(form, "id"), p_novo_saldo: saldo, p_observacao: texto(form, "observacao") || null });
  if (error) return { erro: "Não foi possível ajustar o saldo." };
  revalidatePath("/gestao", "layout");
  return { sucesso: "Saldo ajustado." };
}
