"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { hojeISO } from "@/lib/garagem";
import { lerDinheiro, BANDEIRAS } from "@/lib/gestao";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dia = (f: FormData, n: string) => {
  const v = Number.parseInt(texto(f, n), 10);
  return v >= 1 && v <= 31 ? v : null;
};

/** Cadastra ou edita um cartão de crédito da empresa. */
export async function salvarCartao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const nome = texto(form, "nome").slice(0, 60);
  const final = texto(form, "final").replace(/\D/g, "");
  const fechamento = dia(form, "dia_fechamento");
  const vencimento = dia(form, "dia_vencimento");
  if (nome.length < 2) return { erro: "Informe o nome do cartão (ex.: Nubank PJ)." };
  if (final && final.length !== 4) return { erro: "Final do cartão: os 4 últimos números." };
  if (!fechamento || !vencimento) return { erro: "Informe o dia do fechamento e o dia do vencimento (1 a 31)." };
  const limite = lerDinheiro(texto(form, "limite"));
  const dados = {
    nome,
    final: final || null,
    limite: limite && limite > 0 ? limite : null,
    dia_fechamento: fechamento,
    dia_vencimento: vencimento,
    conta_pagamento_id: texto(form, "conta_pagamento_id") || null,
    ...(id ? { ativo: form.get("ativo") === "on" } : {}),
  };
  const supabase = await createClient();
  const { data: salvo, error } = id
    ? await supabase.from("cartoes").update(dados).eq("id", id).select("id").single()
    : await supabase.from("cartoes").insert(dados).select("id").single();
  if (error) {
    console.error("[cartoes]", error);
    if (error.code === "42P01" || error.code === "PGRST205") return { erro: "Falta atualizar o banco: rode o arquivo 0015_cartoes_credito.sql no Supabase." };
    return { erro: "Não foi possível salvar o cartão." };
  }
  // Cor e bandeira (0021); sem a migração, não faz nada
  const cor = texto(form, "cor");
  const bandeira = texto(form, "bandeira");
  if (salvo?.id) {
    await supabase
      .from("cartoes")
      .update({ cor: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null, bandeira: bandeira in BANDEIRAS ? bandeira : null })
      .eq("id", salvo.id);
  }
  revalidatePath("/gestao", "layout");
  // Salvou: fecha a janela de edição e volta para a lista
  redirect(`/gestao/financeiro/contas?salvo=${encodeURIComponent(id ? "Cartão atualizado." : "Cartão cadastrado.")}#cartoes`);
}

/** Paga a fatura de um mês: as compras dela saem da conta escolhida, de uma vez. */
export async function pagarFaturaCartao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const data = texto(form, "data") || hojeISO();
  const conta = texto(form, "conta_id");
  if (!conta) return { erro: "Escolha a conta que pagou a fatura." };
  const supabase = await createClient();
  const { data: qtd, error } = await supabase.rpc("gestao_pagar_fatura_cartao", {
    p_cartao: texto(form, "cartao_id"),
    p_fatura_mes: texto(form, "fatura_mes"),
    p_conta: conta,
    p_data: data,
  });
  if (error) {
    console.error("[cartoes] pagar", error);
    return { erro: error.message.includes("não tem compras") ? error.message : "Não foi possível registrar o pagamento da fatura." };
  }
  revalidatePath("/gestao", "layout");
  return { sucesso: `Fatura paga: ${qtd} ${qtd === 1 ? "compra quitada" : "compras quitadas"}.` };
}
