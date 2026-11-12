"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATEGORIAS, formatarValor, hojeISO, nomeVeiculo, pastaFotos, type ItemOrcamento } from "@/lib/garagem";
import { notificar, notificarEmpresa } from "@/lib/notificar";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
function valor(s: string): number | null {
  const limpo = s.replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const v = limpo.includes(",") ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}

async function veiculoDe(veiculoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculos")
    .select("*")
    .eq("id", veiculoId)
    .maybeSingle();
  return data;
}

async function orcamentoBasico(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orcamentos")
    .select("id, numero, veiculo_id, apontamento_id, situacao, valor_total, veiculo:veiculos (id, dono_id, placa, marca, modelo, apelido)")
    .eq("id", id)
    .maybeSingle();
  return data as unknown as {
    id: string;
    numero: number;
    veiculo_id: string;
    apontamento_id: string | null;
    situacao: string;
    valor_total: number | null;
    veiculo: { id: string; dono_id: string | null; placa: string; marca: string; modelo: string; apelido: string | null } | null;
  } | null;
}

/** Cliente pede um orçamento (com fotos). Também usado quando ele responde a um apontamento. */
export async function pedirOrcamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const veiculo = await veiculoDe(texto(form, "veiculo_id"));
  if (!veiculo) return { erro: "Escolha o veículo." };
  const categoria = texto(form, "categoria");
  if (!(categoria in CATEGORIAS)) return { erro: "Escolha a categoria." };
  const pedido = texto(form, "pedido").slice(0, 2000);
  if (pedido.length < 5) return { erro: "Conte o que você precisa (ex.: polimento e vitrificação)." };
  const fotos = form
    .getAll("fotos")
    .map(String)
    .filter((p) => p.startsWith(`${pastaFotos(veiculo)}/`) && !p.includes(".."))
    .slice(0, 8);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ veiculo_id: veiculo.id, categoria, pedido, fotos })
    .select("id, numero")
    .single();
  if (error || !data) {
    console.error("[orcamento]", error);
    return { erro: error?.code === "42P01" || error?.code === "PGRST205" ? "Falta atualizar o banco (arquivo 0006_orcamentos.sql)." : "Não foi possível enviar o pedido." };
  }

  await notificarEmpresa(
    {
      titulo: `Novo pedido de orçamento #${data.numero}`,
      corpo: `${usuario.nome || "Cliente"} · ${nomeVeiculo(veiculo)} (${veiculo.placa}) — ${pedido.slice(0, 120)}`,
      link: `/orcamentos/${data.id}`,
    },
    await getSiteUrl(),
  );

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data.id}?enviado=1`);
}

/** Empresa responde (ou envia por iniciativa própria) com itens, prazo e validade. */
export async function responderOrcamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirAdmin();
  const supabase = await createClient();

  const descricoes = form.getAll("item_descricao").map((v) => String(v).trim());
  const valores = form.getAll("item_valor").map((v) => valor(String(v)));
  const itens: ItemOrcamento[] = descricoes
    .map((descricao, i) => ({ descricao: descricao.slice(0, 200), valor: valores[i] ?? 0 }))
    .filter((i) => i.descricao);
  if (itens.length === 0) return { erro: "Adicione pelo menos um item com descrição e valor." };
  const total = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
  const prazo = texto(form, "prazo_dias") ? Number.parseInt(texto(form, "prazo_dias"), 10) : null;
  const validade = texto(form, "validade");
  if (!dataValida(validade)) return { erro: "Informe até quando o orçamento é válido." };
  if (validade < hojeISO()) return { erro: "A validade não pode estar no passado." };

  const resposta = {
    itens,
    valor_total: total,
    prazo_dias: prazo != null && Number.isFinite(prazo) ? prazo : null,
    validade,
    observacoes: texto(form, "observacoes").slice(0, 2000) || null,
    situacao: "respondido",
    respondido_em: new Date().toISOString(),
    motivo_recusa: null,
    decidido_em: null,
  };

  let id = texto(form, "id");
  if (id) {
    const { error } = await supabase.from("orcamentos").update(resposta).eq("id", id);
    if (error) return { erro: "Não foi possível salvar a resposta." };
  } else {
    // Orçamento enviado pela empresa sem pedido do cliente
    const veiculo = await veiculoDe(texto(form, "veiculo_id"));
    if (!veiculo) return { erro: "Veículo não encontrado." };
    const categoria = texto(form, "categoria") in CATEGORIAS ? texto(form, "categoria") : "outros";
    const { data, error } = await supabase
      .from("orcamentos")
      .insert({ ...resposta, veiculo_id: veiculo.id, categoria, solicitado_por: usuario.id, pedido: texto(form, "pedido") || null })
      .select("id")
      .single();
    if (error || !data) return { erro: "Não foi possível criar o orçamento." };
    id = data.id;
  }

  const o = await orcamentoBasico(id);
  if (o?.veiculo) {
    await notificar(
      [o.veiculo.dono_id],
      {
        titulo: `Seu orçamento #${o.numero} chegou 💬`,
        corpo: `${nomeVeiculo(o.veiculo)} — total ${formatarValor(total)}${resposta.prazo_dias != null ? ` · prazo ${resposta.prazo_dias} ${resposta.prazo_dias === 1 ? "dia" : "dias"}` : ""}. Toque para ver e aprovar.`,
        link: `/orcamentos/${id}`,
      },
      await getSiteUrl(),
    );
  }

  revalidatePath(`/orcamentos/${id}`);
  redirect(`/orcamentos/${id}?respondido=1`);
}

/** Cliente aprova ou recusa; ou cancela o pedido antes da resposta. */
export async function decidirOrcamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const id = texto(form, "id");
  const decisao = texto(form, "decisao");
  if (!["aceito", "recusado", "cancelado"].includes(decisao)) return { erro: "Ação inválida." };

  const o = await orcamentoBasico(id);
  if (!o) return { erro: "Orçamento não encontrado." };

  const supabase = await createClient();
  const motivo = texto(form, "motivo").slice(0, 500) || null;
  const { error } = await supabase
    .from("orcamentos")
    .update({ situacao: decisao, motivo_recusa: decisao === "recusado" ? motivo : null })
    .eq("id", id);
  if (error) return { erro: "Não foi possível registrar. O orçamento pode ter sido alterado; recarregue a página." };

  // Se veio de um apontamento, ele acompanha a decisão
  if (o.apontamento_id && decisao === "aceito") {
    await supabase.from("apontamentos").update({ situacao: "agendamento" }).eq("id", o.apontamento_id);
  }

  const textos = {
    aceito: { titulo: `✅ Orçamento #${o.numero} aprovado`, corpo: "O cliente aprovou. Combine a data do serviço." },
    recusado: { titulo: `Orçamento #${o.numero} recusado`, corpo: motivo ? `Motivo: “${motivo}”` : "O cliente recusou o orçamento." },
    cancelado: { titulo: `Pedido de orçamento #${o.numero} cancelado`, corpo: "O cliente cancelou o pedido." },
  }[decisao as "aceito" | "recusado" | "cancelado"];

  await notificarEmpresa(
    {
      titulo: textos.titulo,
      corpo: `${usuario.nome || "Cliente"}${o.veiculo ? ` · ${nomeVeiculo(o.veiculo)} (${o.veiculo.placa})` : ""} — ${textos.corpo}`,
      link: `/orcamentos/${id}`,
    },
    await getSiteUrl(),
  );

  revalidatePath(`/orcamentos/${id}`);
  return {
    sucesso:
      decisao === "aceito"
        ? "Orçamento aprovado! Agora é só escolher os dias para o serviço."
        : decisao === "recusado"
          ? "Tudo bem, registramos sua resposta."
          : "Pedido cancelado.",
  };
}

export async function excluirOrcamento(form: FormData) {
  if (!isSupabaseConfigured) return;
  await exigirAdmin();
  const supabase = await createClient();
  await supabase.from("orcamentos").delete().eq("id", texto(form, "id"));
  revalidatePath("/orcamentos");
  redirect("/orcamentos");
}
