"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { hojeISO } from "@/lib/garagem";
import { MAX_PARCELAS, TIPOS_CONTA, ehFormaPagamento, lerDinheiro, lerNumero } from "@/lib/gestao";
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

  // Formas de recebimento e taxas (%)
  const formas = form.getAll("formas").map(String).filter(ehFormaPagamento);
  const taxa = (campo: string) => {
    const v = lerNumero(texto(form, campo));
    return v == null ? 0 : v;
  };
  const taxas = { taxa_pix: taxa("taxa_pix"), taxa_debito: taxa("taxa_debito"), taxa_credito: taxa("taxa_credito") };
  const taxasParcelado: Record<string, number> = {};
  if (formas.includes("credito")) {
    for (let p = 2; p <= MAX_PARCELAS; p++) {
      const v = lerNumero(texto(form, `parc_${p}`));
      if (v != null) taxasParcelado[String(p)] = v;
    }
  }
  if ([...Object.values(taxas), ...Object.values(taxasParcelado)].some((v) => v < 0 || v > 30)) return { erro: "As taxas devem ficar entre 0% e 30%." };

  const supabase = await createClient();
  const basico = { nome, tipo, saldo_inicial: saldoInicial, ...(id ? { ativa: form.get("ativa") === "on" } : {}) };
  const completo = { ...basico, formas, ...taxas, taxas_parcelado: taxasParcelado };
  const gravar = (dados: Record<string, unknown>) => (id ? supabase.from("contas").update(dados).eq("id", id) : supabase.from("contas").insert(dados));
  let { error } = await gravar(completo);
  let aviso = "";
  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ error } = await gravar(basico));
    aviso = " Para salvar as formas de recebimento e as taxas, rode o arquivo 0011_formas_recebimento.sql no Supabase.";
  }
  if (error) return { erro: "Não foi possível salvar a conta." };
  revalidatePath("/gestao", "layout");
  return { sucesso: (id ? "Conta atualizada." : "Conta criada.") + aviso };
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
  if (vagas < 1 || vagas > 100) return { erro: "Vagas do pátio: entre 1 e 100." };
  const supabase = await createClient();
  const { error } = await supabase.from("gestao_config").update({ vagas_patio: vagas, atualizado_em: new Date().toISOString() }).eq("id", true);
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/gestao", "layout");
  return { sucesso: "Configurações salvas." };
}
