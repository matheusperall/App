"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { hojeISO, somarMeses } from "@/lib/garagem";
import { MAX_PARCELAS, TIPOS_CONTA, ehFormaPagamento, faturaDaCompra, lerDinheiro, lerNumero } from "@/lib/gestao";
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
  const descricao = texto(form, "descricao").slice(0, 180);
  const valor = lerDinheiro(texto(form, "valor"));
  const data = texto(form, "data");
  const pago = texto(form, "pago") !== "nao";
  const vencimento = texto(form, "vencimento") || null;
  const repeticao = texto(form, "repeticao") || "unica";
  const cartaoId = tipo === "saida" ? texto(form, "cartao_id") : "";
  if (tipo !== "entrada" && tipo !== "saida") return { erro: "Escolha entrada ou saída." };
  if (descricao.length < 2) return { erro: "Descreva o lançamento." };
  if (!valor || valor <= 0) return { erro: "Informe o valor." };
  if (!dataValida(data)) return { erro: "Informe a data." };
  if (!cartaoId && !pago && (!vencimento || !dataValida(vencimento))) return { erro: "Informe o vencimento." };
  if (!["unica", "recorrente", "parcelado"].includes(repeticao)) return { erro: "Repetição inválida." };

  const vezes = repeticao === "unica" ? 1 : Math.round(lerNumero(texto(form, "vezes")) ?? 0);
  if (repeticao === "parcelado" && (vezes < 2 || vezes > 48)) return { erro: "Parcelado: de 2 a 48 parcelas." };
  if (repeticao === "recorrente" && (vezes < 2 || vezes > 60)) return { erro: "Recorrente: de 2 a 60 meses." };

  // Valor de cada lançamento (no parcelado, os centavos que sobram vão na primeira parcela)
  const centavos = Math.round(valor * 100);
  const porParcela = repeticao === "parcelado" ? Math.floor(centavos / vezes) : centavos;
  const sobra = repeticao === "parcelado" ? centavos - porParcela * vezes : 0;
  const grupo = vezes > 1 ? crypto.randomUUID() : null;
  const supabase = await createClient();

  // Compra no cartão de crédito: cada parcela cai numa fatura; fica a pagar até a fatura ser paga
  let cartao: { dia_fechamento: number; dia_vencimento: number } | null = null;
  if (cartaoId) {
    const { data: c } = await supabase.from("cartoes").select("dia_fechamento, dia_vencimento").eq("id", cartaoId).maybeSingle();
    if (!c) return { erro: "Cartão não encontrado. Se acabou de atualizar, rode o arquivo 0015_cartoes_credito.sql no Supabase." };
    cartao = c;
  }
  const base = {
    tipo,
    categoria_id: texto(form, "categoria_id") || null,
    conta_id: texto(form, "conta_id") || null,
  };
  const linhas = Array.from({ length: vezes }, (_, i) => {
    const primeira = i === 0;
    if (cartao) {
      const f = repeticao === "parcelado" ? faturaDaCompra(data, cartao, i) : faturaDaCompra(somarMeses(data, i), cartao);
      return {
        ...base,
        conta_id: null,
        cartao_id: cartaoId,
        fatura_mes: f.fatura_mes,
        descricao: repeticao === "parcelado" ? `${descricao} (${i + 1}/${vezes})` : descricao,
        valor: (porParcela + (primeira ? sobra : 0)) / 100,
        data: somarMeses(data, i),
        vencimento: f.vencimento,
        pago: false,
        pago_em: null,
        ...(grupo ? { grupo_id: grupo, parcela: i + 1, total_parcelas: vezes, recorrente: repeticao === "recorrente" } : {}),
      };
    }
    const quitada = primeira && pago;
    const venc = somarMeses(pago ? data : vencimento!, i);
    return {
      ...base,
      descricao: repeticao === "parcelado" ? `${descricao} (${i + 1}/${vezes})` : descricao,
      valor: (porParcela + (primeira ? sobra : 0)) / 100,
      data: somarMeses(data, i),
      vencimento: quitada ? null : venc,
      pago: quitada,
      pago_em: quitada ? data : null,
      ...(grupo ? { grupo_id: grupo, parcela: i + 1, total_parcelas: vezes, recorrente: repeticao === "recorrente" } : {}),
    };
  });

  const { error } = await supabase.from("lancamentos").insert(linhas);
  if (error) {
    if (error.code === "PGRST204" || error.code === "42703")
      return { erro: "Falta atualizar o banco: rode o arquivo 0012_faturas_e_lancamentos.sql no Supabase (veja docs/GESTAO.md)." };
    return { erro: "Não foi possível salvar o lançamento." };
  }
  revalidatePath("/gestao", "layout");
  if (cartao) return { sucesso: vezes > 1 ? `Compra lançada no cartão em ${vezes} ${repeticao === "parcelado" ? "parcelas" : "meses"}, cada uma na sua fatura.` : "Compra lançada na fatura do cartão." };
  if (vezes > 1)
    return { sucesso: `${vezes} lançamentos criados (${repeticao === "parcelado" ? "parcelas" : "um por mês"}). Os próximos aparecem em “a pagar/receber”.` };
  return { sucesso: pago ? "Lançamento registrado." : "Conta registrada. Ela aparece em “a pagar/receber” até ser marcada como paga." };
}

/** Apaga os lançamentos ainda não pagos de uma série (recorrente ou parcelado), a partir deste. */
export async function encerrarSerie(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const supabase = await createClient();
  const { data: l } = await supabase.from("lancamentos").select("grupo_id, data").eq("id", texto(form, "id")).maybeSingle();
  if (!l?.grupo_id) return { erro: "Este lançamento não faz parte de uma série." };
  const { error, count } = await supabase
    .from("lancamentos")
    .delete({ count: "exact" })
    .eq("grupo_id", l.grupo_id)
    .eq("pago", false)
    .gte("data", l.data);
  if (error) return { erro: "Não foi possível encerrar a série." };
  revalidatePath("/gestao", "layout");
  return { sucesso: `${count ?? 0} lançamento(s) futuro(s) não pago(s) apagado(s).` };
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
