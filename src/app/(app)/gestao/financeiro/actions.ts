"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { hojeISO } from "@/lib/garagem";
import { TIPOS_CONTA, lerDinheiro, lerNumero } from "@/lib/gestao";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function salvarConta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const nome = texto(form, "nome").slice(0, 60);
  const tipo = texto(form, "tipo");
  const saldoInicial = lerDinheiro(texto(form, "saldo_inicial")) ?? 0;
  if (nome.length < 2) return { erro: "Informe o nome da conta." };
  if (!(tipo in TIPOS_CONTA)) return { erro: "Escolha o tipo da conta." };
  const supabase = await createClient();
  const dados = { nome, tipo, saldo_inicial: saldoInicial, ...(id ? { ativa: form.get("ativa") === "on" } : {}) };
  const { error } = id ? await supabase.from("contas").update(dados).eq("id", id) : await supabase.from("contas").insert(dados);
  if (error) return { erro: "Não foi possível salvar a conta." };
  revalidatePath("/gestao", "layout");
  return { sucesso: id ? "Conta atualizada." : "Conta criada." };
}

export async function salvarLancamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const tipo = texto(form, "tipo");
  const descricao = texto(form, "descricao").slice(0, 200);
  const valor = lerDinheiro(texto(form, "valor"));
  const data = texto(form, "data");
  const pago = texto(form, "pago") !== "nao";
  const vencimento = texto(form, "vencimento") || null;
  if (tipo !== "entrada" && tipo !== "saida") return { erro: "Escolha entrada ou saída." };
  if (descricao.length < 2) return { erro: "Descreva o lançamento." };
  if (!valor || valor <= 0) return { erro: "Informe o valor." };
  if (!dataValida(data)) return { erro: "Informe a data." };
  if (!pago && (!vencimento || !dataValida(vencimento))) return { erro: "Informe o vencimento." };
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert({
    tipo,
    descricao,
    valor,
    data,
    vencimento: pago ? null : vencimento,
    categoria_id: texto(form, "categoria_id") || null,
    conta_id: texto(form, "conta_id") || null,
    pago,
    pago_em: pago ? data : null,
  });
  if (error) return { erro: "Não foi possível salvar o lançamento." };
  revalidatePath("/gestao", "layout");
  return { sucesso: pago ? "Lançamento registrado." : "Conta registrada. Ela aparece em “a pagar/receber” até ser marcada como paga." };
}

export async function marcarPago(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const data = texto(form, "data") || hojeISO();
  const conta = texto(form, "conta_id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update({ pago: true, pago_em: data, ...(conta ? { conta_id: conta } : {}) })
    .eq("id", texto(form, "id"));
  if (error) return { erro: "Não foi possível marcar como pago." };
  revalidatePath("/gestao", "layout");
  return { sucesso: "Marcado como pago." };
}

export async function excluirLancamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const supabase = await createClient();
  const id = texto(form, "id");
  const { data } = await supabase.from("lancamentos").select("os_id, fatura_id").eq("id", id).maybeSingle();
  if (!data) return { erro: "Lançamento não encontrado." };
  if (data.os_id || data.fatura_id) return { erro: "Este lançamento veio de uma OS ou fatura e não pode ser apagado aqui." };
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { erro: "Não foi possível apagar." };
  revalidatePath("/gestao", "layout");
  return { sucesso: "Lançamento apagado." };
}

export async function salvarConfig(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const vagas = Math.round(lerNumero(texto(form, "vagas_patio")) ?? 0);
  const debito = lerNumero(texto(form, "taxa_debito"));
  const credito = lerNumero(texto(form, "taxa_credito"));
  if (vagas < 1 || vagas > 100) return { erro: "Vagas do pátio: entre 1 e 100." };
  if (debito == null || debito < 0 || debito > 30 || credito == null || credito < 0 || credito > 30) return { erro: "Taxas inválidas (use % entre 0 e 30)." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("gestao_config")
    .update({ vagas_patio: vagas, taxa_debito: debito, taxa_credito: credito, atualizado_em: new Date().toISOString() })
    .eq("id", true);
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/gestao", "layout");
  return { sucesso: "Configurações salvas." };
}
