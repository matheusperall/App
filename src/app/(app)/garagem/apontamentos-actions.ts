"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATEGORIAS, PRIORIDADES, nomeVeiculo, pastaFotos } from "@/lib/garagem";
import { notificar, notificarEmpresa } from "@/lib/notificar";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

async function carregarVeiculo(veiculoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculos")
    .select("*, dono:perfis!veiculos_dono_id_fkey (nome)")
    .eq("id", veiculoId)
    .maybeSingle();
  return data as
    | { id: string; dono_id: string | null; cliente_id?: string; placa: string; marca: string; modelo: string; apelido: string | null; dono: { nome: string } | null }
    | null;
}

/** A empresa registra um apontamento e o cliente é avisado. */
export async function criarApontamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirAdmin();
  const veiculoId = texto(form, "veiculo_id");
  const veiculo = await carregarVeiculo(veiculoId);
  if (!veiculo) return { erro: "Veículo não encontrado." };

  const categoria = texto(form, "categoria");
  const prioridade = texto(form, "prioridade");
  const titulo = texto(form, "titulo");
  if (!(categoria in CATEGORIAS)) return { erro: "Escolha a categoria." };
  if (!(prioridade in PRIORIDADES)) return { erro: "Escolha a prioridade." };
  if (titulo.length < 3) return { erro: "Descreva o apontamento (ex.: Risco na porta traseira)." };

  const fotos = form
    .getAll("fotos")
    .map(String)
    .filter((p) => p.startsWith(`${pastaFotos(veiculo)}/`) && !p.includes(".."))
    .slice(0, 8);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("apontamentos")
    .insert({
      veiculo_id: veiculoId,
      categoria,
      prioridade,
      titulo,
      descricao: texto(form, "descricao") || null,
      fotos,
      criado_por: usuario.id,
    })
    .select("id")
    .single();
  if (error || !data) return { erro: "Não foi possível salvar o apontamento." };

  await notificar(
    [veiculo.dono_id],
    {
      titulo: `${prioridade === "urgente" ? "⚠️ " : ""}Novo apontamento no seu ${nomeVeiculo(veiculo)}`,
      corpo: `${titulo} — ${PRIORIDADES[prioridade as keyof typeof PRIORIDADES].rotulo}. Toque para ver e pedir orçamento ou agendamento.`,
      link: `/garagem/${veiculoId}/apontamentos/${data.id}`,
    },
    await getSiteUrl(),
  );

  revalidatePath(`/garagem/${veiculoId}`);
  redirect(`/garagem/${veiculoId}?apontado=1`);
}

const RESPOSTAS = {
  orcamento: { aviso: "pediu um orçamento", confirmacao: "Pedido de orçamento enviado! Você vai receber os valores na aba Orçamentos." },
  agendamento: { aviso: "quer agendar", confirmacao: "Pedido de agendamento enviado! Vamos entrar em contato para combinar o horário." },
  recusado: { aviso: "deixou para depois", confirmacao: "Tudo bem! O apontamento fica guardado no histórico do veículo." },
} as const;

/** O cliente responde ao apontamento: orçamento, agendamento ou "agora não". */
export async function responderApontamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const id = texto(form, "id");
  const resposta = texto(form, "resposta");
  if (!(resposta in RESPOSTAS)) return { erro: "Resposta inválida." };

  const supabase = await createClient();
  const { data: apontamento } = await supabase
    .from("apontamentos")
    .select("id, veiculo_id, titulo, situacao, categoria, fotos")
    .eq("id", id)
    .maybeSingle();
  if (!apontamento) return { erro: "Apontamento não encontrado." };
  if (!["pendente", "recusado", "orcamento", "agendamento"].includes(apontamento.situacao))
    return { erro: "Este apontamento já está com a nossa equipe." };

  const mensagem = texto(form, "mensagem").slice(0, 1000) || null;
  const { error } = await supabase
    .from("apontamentos")
    .update({ situacao: resposta, mensagem_cliente: mensagem })
    .eq("id", id);
  if (error) return { erro: "Não foi possível enviar sua resposta." };

  const r = RESPOSTAS[resposta as keyof typeof RESPOSTAS];
  const veiculo = await carregarVeiculo(apontamento.veiculo_id);

  // Pedido de orçamento a partir do apontamento: cria o orçamento ligado a ele (se ainda não existe)
  let link = `/garagem/${apontamento.veiculo_id}/apontamentos/${id}`;
  if (resposta === "orcamento") {
    const { data: existente } = await supabase
      .from("orcamentos")
      .select("id")
      .eq("apontamento_id", id)
      .in("situacao", ["solicitado", "respondido"])
      .maybeSingle();
    if (existente) link = `/orcamentos/${existente.id}`;
    else {
      const { data: novo } = await supabase
        .from("orcamentos")
        .insert({
          veiculo_id: apontamento.veiculo_id,
          apontamento_id: id,
          categoria: apontamento.categoria,
          pedido: `${apontamento.titulo}${mensagem ? `\n\n${mensagem}` : ""}`,
          fotos: apontamento.fotos,
        })
        .select("id")
        .single();
      if (novo) link = `/orcamentos/${novo.id}`;
    }
  }

  if (resposta !== "recusado" || usuario.papel !== "admin") {
    await notificarEmpresa(
      {
        titulo: `${usuario.nome || "Cliente"} ${r.aviso}`,
        corpo: `${apontamento.titulo}${veiculo ? ` · ${nomeVeiculo(veiculo)} (${veiculo.placa})` : ""}${mensagem ? ` — “${mensagem}”` : ""}`,
        link,
      },
      await getSiteUrl(),
    );
  }

  revalidatePath(`/garagem/${apontamento.veiculo_id}`);
  return { sucesso: r.confirmacao };
}

const MUDANCAS_EMPRESA = {
  agendado: { titulo: "Serviço agendado", corpo: (t: string) => `${t}: seu serviço foi agendado. Qualquer dúvida, fale com a gente.` },
  concluido: { titulo: "Serviço concluído ✓", corpo: (t: string) => `${t}: serviço concluído. Obrigado pela confiança!` },
  pendente: null,
} as const;

/** A empresa muda a situação: agendado, concluído ou reabre. */
export async function mudarSituacaoApontamento(form: FormData) {
  if (!isSupabaseConfigured) return;
  await exigirAdmin();
  const id = texto(form, "id");
  const situacao = texto(form, "situacao");
  if (!(situacao in MUDANCAS_EMPRESA)) return;

  const supabase = await createClient();
  const { data: apontamento } = await supabase
    .from("apontamentos")
    .update({ situacao })
    .eq("id", id)
    .select("id, veiculo_id, titulo")
    .single();
  if (!apontamento) return;

  const aviso = MUDANCAS_EMPRESA[situacao as keyof typeof MUDANCAS_EMPRESA];
  const veiculo = aviso ? await carregarVeiculo(apontamento.veiculo_id) : null;
  if (aviso && veiculo) {
    await notificar(
      [veiculo.dono_id],
      { titulo: aviso.titulo, corpo: aviso.corpo(apontamento.titulo), link: `/garagem/${veiculo.id}/apontamentos/${id}` },
      await getSiteUrl(),
    );
  }
  revalidatePath(`/garagem/${apontamento.veiculo_id}/apontamentos/${id}`);
}

export async function excluirApontamento(form: FormData) {
  if (!isSupabaseConfigured) return;
  await exigirAdmin();
  const id = texto(form, "id");
  const veiculoId = texto(form, "veiculo_id");
  const supabase = await createClient();
  await supabase.from("apontamentos").delete().eq("id", id);
  revalidatePath(`/garagem/${veiculoId}`);
  redirect(`/garagem/${veiculoId}`);
}
