"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { hojeISO } from "@/lib/garagem";
import { ehFormaPagamento, lerDinheiro } from "@/lib/gestao";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function gerarFatura(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const clienteId = texto(form, "cliente_id");
  const os = form.getAll("os").map(String).filter(Boolean);
  const vencimento = texto(form, "vencimento");
  if (os.length === 0) return { erro: "Marque as OS que entram na fatura." };
  if (!dataValida(vencimento)) return { erro: "Informe o vencimento." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gestao_gerar_fatura", {
    p_cliente: clienteId,
    p_os: os,
    p_vencimento: vencimento,
    p_observacoes: texto(form, "observacoes") || null,
  });
  if (error || !data) {
    console.error("[faturas] gerar", error);
    return { erro: error?.message.startsWith("Algumas OS") ? error.message : "Não foi possível gerar a fatura." };
  }
  revalidatePath("/gestao", "layout");
  redirect(`/gestao/faturas/${data}?nova=1`);
}

export async function pagarFatura(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const valor = lerDinheiro(texto(form, "valor"));
  const forma = texto(form, "forma");
  const conta = texto(form, "conta_id");
  const data = texto(form, "data") || hojeISO();
  if (!valor || valor <= 0) return { erro: "Informe o valor recebido." };
  if (!ehFormaPagamento(forma)) return { erro: "Escolha a forma de pagamento." };
  if (!conta) return { erro: "Escolha a conta." };
  if (!dataValida(data)) return { erro: "Data inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("gestao_pagar_fatura", { p_fatura: texto(form, "id"), p_valor: valor, p_forma: forma, p_conta: conta, p_data: data });
  if (error) {
    console.error("[faturas] pagar", error);
    return { erro: error.message.startsWith("Valor inválido") || error.message.includes("não está em aberto") ? error.message : "Não foi possível registrar o pagamento." };
  }
  revalidatePath("/gestao", "layout");
  return { sucesso: "Pagamento registrado no financeiro." };
}

/** Cancela uma fatura sem pagamentos: as OS voltam para "a faturar". */
export async function cancelarFatura(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const id = texto(form, "id");
  const supabase = await createClient();
  const { data: f } = await supabase.from("faturas").select("valor_pago, situacao").eq("id", id).maybeSingle();
  if (!f) return { erro: "Fatura não encontrada." };
  if (Number(f.valor_pago) > 0) return { erro: "Esta fatura já tem pagamento registrado e não pode ser cancelada." };
  await supabase.from("ordens_servico").update({ fatura_id: null }).eq("fatura_id", id);
  const { error } = await supabase.from("faturas").update({ situacao: "cancelada" }).eq("id", id);
  if (error) return { erro: "Não foi possível cancelar." };
  revalidatePath("/gestao", "layout");
  return { sucesso: "Fatura cancelada. As OS voltaram para a lista de “a faturar”." };
}
