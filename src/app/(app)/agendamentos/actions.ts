"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/app/(auth)/actions";
import { FUNCIONAMENTO, LAVAGEM_MINUTOS, PERIODOS, dataHora, formatarQuando, type Periodo, type Preferencia } from "@/lib/agenda";
import { horariosDisponiveis } from "@/lib/agenda-servidor";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATEGORIAS, hojeISO, nomeVeiculo } from "@/lib/garagem";
import { atualizarEvento, criarEvento, excluirEvento, googleConfigurado, type Evento } from "@/lib/google-agenda";
import { notificar, notificarEmpresa } from "@/lib/notificar";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEMO: EstadoForm = { erro: "Modo demonstração: conecte o banco de dados para salvar." };
const texto = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const horaValida = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const erroTabela = (e: { code?: string } | null) =>
  e?.code === "42P01" || e?.code === "PGRST205" ? "Falta atualizar o banco (arquivo 0007_agendamentos.sql)." : null;

type VeiculoBasico = { id: string; dono_id: string; placa: string; marca: string; modelo: string; apelido: string | null; dono?: { nome: string; telefone: string | null } | null };

async function veiculoAcessivel(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculos")
    .select("id, dono_id, placa, marca, modelo, apelido, dono:perfis!veiculos_dono_id_fkey (nome, telefone)")
    .eq("id", id)
    .maybeSingle();
  return data as unknown as VeiculoBasico | null;
}

function eventoDe(a: { tipo: string; servico: string; observacoes?: string | null; inicio: Date; fim: Date }, v: VeiculoBasico, site: string, id: string): Evento {
  return {
    titulo: `${a.tipo === "lavagem" ? "🧽" : "🔧"} ${a.servico} — ${v.dono?.nome ?? "Cliente"} (${v.placa})`,
    descricao: [
      `Cliente: ${v.dono?.nome ?? "—"}${v.dono?.telefone ? ` · ${v.dono.telefone}` : ""}`,
      `Veículo: ${nomeVeiculo(v)} · ${v.placa}`,
      a.observacoes ? `Observações: ${a.observacoes}` : "",
      `Abrir no app: ${site}/agendamentos/${id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    inicio: a.inicio,
    fim: a.fim,
    ocupa: a.tipo === "lavagem",
  };
}

/** Cliente escolhe um horário livre para lavagem: já fica confirmado. */
export async function agendarLavagem(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const veiculo = await veiculoAcessivel(texto(form, "veiculo_id"));
  if (!veiculo) return { erro: "Escolha o veículo." };
  const dia = texto(form, "dia");
  const hora = texto(form, "hora");
  if (!dataValida(dia) || !horaValida(hora)) return { erro: "Escolha um dia e um horário." };

  // Confere de novo se o horário continua livre
  const { dias } = await horariosDisponiveis();
  if (!dias.find((d) => d.dia === dia)?.horarios.includes(hora)) {
    return { erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
  }

  const admin = createAdminClient();
  if (!admin) return { erro: "Servidor sem a chave SUPABASE_SERVICE_ROLE_KEY." };
  const inicio = dataHora(dia, hora);
  const fim = new Date(inicio.getTime() + LAVAGEM_MINUTOS * 60_000);
  const observacoes = texto(form, "observacoes").slice(0, 500) || null;

  const { data, error } = await admin
    .from("agendamentos")
    .insert({
      veiculo_id: veiculo.id,
      tipo: "lavagem",
      servico: "Lavagem",
      categoria: "estetica",
      situacao: "confirmado",
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      observacoes,
      solicitado_por: usuario.id,
      confirmado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { erro: erroTabela(error) ?? "Não foi possível agendar." };

  const site = await getSiteUrl();
  if (googleConfigurado()) {
    try {
      const eventoId = await criarEvento(eventoDe({ tipo: "lavagem", servico: "Lavagem", observacoes, inicio, fim }, veiculo, site, data.id));
      await admin.from("agendamentos").update({ google_evento_id: eventoId }).eq("id", data.id);
    } catch (e) {
      console.error("[agenda] criar evento", (e as Error).message);
    }
  }

  const quando = formatarQuando(inicio.toISOString(), fim.toISOString());
  await notificarEmpresa(
    { titulo: "🧽 Nova lavagem agendada", corpo: `${usuario.nome || "Cliente"} · ${nomeVeiculo(veiculo)} (${veiculo.placa}) — ${quando}`, link: `/agendamentos/${data.id}` },
    site,
  );
  revalidatePath("/agendamentos");
  redirect(`/agendamentos/${data.id}?agendado=1`);
}

/** Cliente pede agendamento de um serviço, sugerindo dias e períodos. A empresa confirma. */
export async function pedirAgendamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  const usuario = await exigirUsuario();
  const veiculo = await veiculoAcessivel(texto(form, "veiculo_id"));
  if (!veiculo) return { erro: "Escolha o veículo." };
  const servico = texto(form, "servico").slice(0, 200);
  if (servico.length < 3) return { erro: "Diga qual serviço você quer agendar." };
  const categoria = texto(form, "categoria") in CATEGORIAS ? texto(form, "categoria") : "outros";

  const datas = form.getAll("pref_data").map(String);
  const periodos = form.getAll("pref_periodo").map(String);
  const hoje = hojeISO();
  const preferencias: Preferencia[] = datas
    .map((data, i) => ({ data, periodo: (periodos[i] in PERIODOS ? periodos[i] : "qualquer") as Periodo }))
    .filter((p) => dataValida(p.data) && p.data >= hoje)
    .slice(0, 3);
  if (preferencias.length === 0) return { erro: "Sugira pelo menos um dia." };

  const supabase = await createClient();
  const orcamentoId = texto(form, "orcamento_id") || null;
  const apontamentoId = texto(form, "apontamento_id") || null;
  const { data, error } = await supabase
    .from("agendamentos")
    .insert({
      veiculo_id: veiculo.id,
      tipo: "servico",
      servico,
      categoria,
      preferencias,
      observacoes: texto(form, "observacoes").slice(0, 1000) || null,
      orcamento_id: orcamentoId,
      apontamento_id: apontamentoId,
    })
    .select("id")
    .single();
  if (error || !data) return { erro: erroTabela(error) ?? "Não foi possível enviar o pedido." };

  if (apontamentoId) await supabase.from("apontamentos").update({ situacao: "agendamento" }).eq("id", apontamentoId);

  await notificarEmpresa(
    {
      titulo: "📅 Novo pedido de agendamento",
      corpo: `${usuario.nome || "Cliente"} · ${nomeVeiculo(veiculo)} (${veiculo.placa}) — ${servico}`,
      link: `/agendamentos/${data.id}`,
    },
    await getSiteUrl(),
  );
  revalidatePath("/agendamentos");
  redirect(`/agendamentos/${data.id}?enviado=1`);
}

/** Empresa confirma (ou remarca) com dia, hora e duração. Cria/atualiza o evento na Google Agenda. */
export async function confirmarAgendamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const supabase = await createClient();
  const id = texto(form, "id");
  const { data: a } = await supabase
    .from("agendamentos")
    .select("id, veiculo_id, tipo, servico, observacoes, apontamento_id, google_evento_id, situacao")
    .eq("id", id)
    .maybeSingle();
  if (!a) return { erro: "Agendamento não encontrado." };
  const veiculo = await veiculoAcessivel(a.veiculo_id);
  if (!veiculo) return { erro: "Veículo não encontrado." };

  const dia = texto(form, "dia");
  const hora = texto(form, "hora");
  if (!dataValida(dia) || !horaValida(hora)) return { erro: "Informe o dia e o horário." };
  const duracao = texto(form, "duracao"); // "60" (minutos) ou "d3" (dias)
  const inicio = dataHora(dia, hora);
  let fim: Date;
  if (duracao.startsWith("d")) {
    const nDias = Math.max(1, Number.parseInt(duracao.slice(1), 10) || 1);
    fim = dataHora(dia, `${String(FUNCIONAMENTO.fecha).padStart(2, "0")}:00`);
    fim.setUTCDate(fim.getUTCDate() + nDias - 1);
  } else {
    fim = new Date(inicio.getTime() + Math.max(15, Number.parseInt(duracao, 10) || 60) * 60_000);
  }
  if (fim <= inicio) return { erro: "O horário de término precisa ser depois do início." };

  const resposta = texto(form, "resposta").slice(0, 1000) || null;
  const remarcacao = a.situacao === "confirmado";
  const { error } = await supabase
    .from("agendamentos")
    .update({ situacao: "confirmado", inicio: inicio.toISOString(), fim: fim.toISOString(), resposta, confirmado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: "Não foi possível confirmar." };

  const site = await getSiteUrl();
  if (googleConfigurado()) {
    try {
      const ev = eventoDe({ tipo: a.tipo, servico: a.servico, observacoes: a.observacoes, inicio, fim }, veiculo, site, id);
      if (a.google_evento_id) await atualizarEvento(a.google_evento_id, ev);
      else {
        const eventoId = await criarEvento(ev);
        await supabase.from("agendamentos").update({ google_evento_id: eventoId }).eq("id", id);
      }
    } catch (e) {
      console.error("[agenda] evento", (e as Error).message);
    }
  }
  if (a.apontamento_id) await supabase.from("apontamentos").update({ situacao: "agendado" }).eq("id", a.apontamento_id);

  await notificar(
    [veiculo.dono_id],
    {
      titulo: remarcacao ? "📅 Seu agendamento foi remarcado" : "✅ Agendamento confirmado",
      corpo: `${a.servico} · ${nomeVeiculo(veiculo)} — ${formatarQuando(inicio.toISOString(), fim.toISOString())}${resposta ? `. ${resposta}` : ""}`,
      link: `/agendamentos/${id}`,
    },
    site,
  );
  revalidatePath(`/agendamentos/${id}`);
  redirect(`/agendamentos/${id}?confirmado=1`);
}

/** Empresa recusa o pedido (ex.: sem disponibilidade), com uma mensagem. */
export async function recusarAgendamento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  if (!isSupabaseConfigured) return DEMO;
  await exigirAdmin();
  const supabase = await createClient();
  const id = texto(form, "id");
  const resposta = texto(form, "resposta").slice(0, 1000);
  if (resposta.length < 3) return { erro: "Explique ao cliente o motivo (ex.: sugerir outra data)." };
  const { data: a } = await supabase
    .from("agendamentos")
    .update({ situacao: "recusado", resposta })
    .eq("id", id)
    .select("id, servico, veiculo:veiculos (id, dono_id, placa, marca, modelo, apelido)")
    .single();
  const v = (a as unknown as { veiculo: VeiculoBasico | null } | null)?.veiculo;
  if (a && v) {
    await notificar(
      [v.dono_id],
      { titulo: "Sobre o seu pedido de agendamento", corpo: `${(a as { servico: string }).servico}: ${resposta}`, link: `/agendamentos/${id}` },
      await getSiteUrl(),
    );
  }
  revalidatePath(`/agendamentos/${id}`);
  return { sucesso: "Resposta enviada ao cliente." };
}

/** Cancelamento (cliente ou empresa). Remove o evento da Google Agenda. */
export async function cancelarAgendamento(form: FormData) {
  if (!isSupabaseConfigured) return;
  const usuario = await exigirUsuario();
  const supabase = await createClient();
  const id = texto(form, "id");
  const { data: a } = await supabase
    .from("agendamentos")
    .select("id, servico, inicio, google_evento_id, apontamento_id, veiculo:veiculos (id, dono_id, placa, marca, modelo, apelido)")
    .eq("id", id)
    .maybeSingle();
  if (!a) return;
  const { error } = await supabase.from("agendamentos").update({ situacao: "cancelado" }).eq("id", id);
  if (error) return;
  const ag = a as unknown as { servico: string; inicio: string | null; google_evento_id: string | null; apontamento_id: string | null; veiculo: VeiculoBasico | null };
  if (ag.google_evento_id && googleConfigurado()) await excluirEvento(ag.google_evento_id);
  if (ag.apontamento_id) await supabase.from("apontamentos").update({ situacao: "pendente" }).eq("id", ag.apontamento_id);

  const site = await getSiteUrl();
  const corpo = `${ag.servico}${ag.veiculo ? ` · ${nomeVeiculo(ag.veiculo)} (${ag.veiculo.placa})` : ""}${ag.inicio ? ` — ${formatarQuando(ag.inicio)}` : ""}`;
  if (usuario.papel === "admin" && ag.veiculo && ag.veiculo.dono_id !== usuario.id) {
    await notificar([ag.veiculo.dono_id], { titulo: "Agendamento cancelado", corpo, link: `/agendamentos/${id}` }, site);
  } else {
    await notificarEmpresa({ titulo: `${usuario.nome || "Cliente"} cancelou um agendamento`, corpo, link: `/agendamentos/${id}` }, site);
  }
  revalidatePath(`/agendamentos/${id}`);
  redirect(`/agendamentos/${id}`);
}

/** Empresa marca como concluído (e o apontamento ligado também). */
export async function concluirAgendamento(form: FormData) {
  if (!isSupabaseConfigured) return;
  await exigirAdmin();
  const supabase = await createClient();
  const id = texto(form, "id");
  const { data: a } = await supabase
    .from("agendamentos")
    .update({ situacao: "concluido" })
    .eq("id", id)
    .select("veiculo_id, apontamento_id")
    .single();
  if (a?.apontamento_id) await supabase.from("apontamentos").update({ situacao: "concluido" }).eq("id", a.apontamento_id);
  revalidatePath(`/agendamentos/${id}`);
  redirect(a ? `/garagem/${a.veiculo_id}/servicos/novo` : `/agendamentos/${id}`);
}
