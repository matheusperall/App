import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Agendamento } from "@/lib/agenda";
import { TIPOS_DOCUMENTO, hojeISO, rotuloManutencao, somarDias, somarMeses, situacaoManutencao, type Apontamento, type Documento, type Orcamento, type Manutencao, type Servico, type Veiculo } from "@/lib/garagem";

// Todas as leituras passam pelo Supabase com a sessão do usuário,
// então as regras de segurança do banco (RLS) decidem o que cada um vê.

export type Dono = { id: string; nome: string; email: string | null; telefone: string | null };
export type VeiculoComDono = Veiculo & { dono: Dono | null };
export type Cliente = Dono & { criado_em: string; veiculos: { id: string; placa: string; modelo: string }[] };

const CAMPOS_BASICOS =
  "id, dono_id, placa, marca, modelo, ano, cor, apelido, km_atual, km_atualizado_em, foto";
const CAMPOS_VEICULO = `${CAMPOS_BASICOS}, tipo, combustivel, codigo_fipe, valor_fipe, fipe_referencia, fipe_marca_cod, fipe_modelo_cod, fipe_ano_cod`;

/** Se o banco ainda não recebeu as colunas da FIPE (0004), consulta só as básicas. */
const faltaColuna = (e: { code?: string } | null) => e?.code === "42703";

export async function listarVeiculos(donoId: string): Promise<Veiculo[]> {
  if (!isSupabaseConfigured) return DEMO.veiculos.filter((v) => v.dono_id === donoId);
  const supabase = await createClient();
  const consulta = (campos: string) =>
    supabase.from("veiculos").select(campos).eq("dono_id", donoId).order("criado_em");
  let { data, error } = await consulta(CAMPOS_VEICULO);
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_BASICOS));
  return (data as unknown as Veiculo[] | null) ?? [];
}

export async function obterVeiculo(id: string): Promise<VeiculoComDono | null> {
  if (!isSupabaseConfigured) {
    const v = DEMO.veiculos.find((x) => x.id === id);
    return v ? { ...v, dono: DEMO.dono } : null;
  }
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const consulta = (campos: string) =>
    supabase
      .from("veiculos")
      .select(`${campos}, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone)`)
      .eq("id", id)
      .maybeSingle();
  let { data, error } = await consulta(CAMPOS_VEICULO);
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_BASICOS));
  return (data as unknown as VeiculoComDono | null) ?? null;
}

export async function listarServicos(veiculoId: string): Promise<Servico[]> {
  if (!isSupabaseConfigured) return DEMO.servicos.filter((s) => s.veiculo_id === veiculoId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicos")
    .select("id, veiculo_id, data, categoria, titulo, descricao, km, valor, prestador, fotos, pela_empresa")
    .eq("veiculo_id", veiculoId)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  return (data as Servico[] | null) ?? [];
}

export async function obterServico(id: string): Promise<Servico | null> {
  if (!isSupabaseConfigured) return DEMO.servicos.find((s) => s.id === id) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicos")
    .select("id, veiculo_id, data, categoria, titulo, descricao, km, valor, prestador, fotos, pela_empresa")
    .eq("id", id)
    .maybeSingle();
  return (data as Servico | null) ?? null;
}

export async function listarManutencoes(veiculoIds: string[]): Promise<Manutencao[]> {
  if (veiculoIds.length === 0) return [];
  if (!isSupabaseConfigured) return DEMO.manutencoes.filter((m) => veiculoIds.includes(m.veiculo_id));
  const supabase = await createClient();
  const { data } = await supabase
    .from("manutencoes")
    .select("id, veiculo_id, tipo, ultima_data, ultimo_km, intervalo_meses, intervalo_km, proxima_data, proximo_km, definido_pela_empresa")
    .in("veiculo_id", veiculoIds);
  return data ?? [];
}

/** Links temporários (1 hora) para exibir fotos privadas. */
export async function urlsDasFotos(caminhos: (string | null | undefined)[]): Promise<Record<string, string>> {
  const lista = [...new Set(caminhos.filter((c): c is string => Boolean(c)))];
  if (lista.length === 0 || !isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("fotos").createSignedUrls(lista, 3600);
  const mapa: Record<string, string> = {};
  data?.forEach((d) => {
    if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl;
  });
  return mapa;
}

// ---------------------------------------------------------------------------
// Área da empresa
// ---------------------------------------------------------------------------
export async function listarClientes(busca: string): Promise<Cliente[]> {
  if (!isSupabaseConfigured) {
    return [{ ...DEMO.dono, criado_em: "2026-11-01T12:00:00Z", veiculos: DEMO.veiculos.map(({ id, placa, modelo }) => ({ id, placa, modelo })) }];
  }
  const supabase = await createClient();
  const termo = busca.trim().replace(/[%,()]/g, " ").trim();

  let idsPorPlaca: string[] = [];
  if (termo) {
    const placa = termo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placa.length >= 3) {
      const { data } = await supabase.from("veiculos").select("dono_id").ilike("placa", `%${placa}%`).limit(50);
      idsPorPlaca = (data ?? []).map((d) => d.dono_id);
    }
  }

  let consulta = supabase
    .from("perfis")
    .select("id, nome, email, telefone, criado_em, veiculos!veiculos_dono_id_fkey (id, placa, modelo)")
    .eq("papel", "cliente")
    .order("nome")
    .limit(100);

  if (termo) {
    const filtros = [`nome.ilike.%${termo}%`, `email.ilike.%${termo}%`, `telefone.ilike.%${termo}%`];
    if (idsPorPlaca.length) filtros.push(`id.in.(${idsPorPlaca.join(",")})`);
    consulta = consulta.or(filtros.join(","));
  }

  const { data } = await consulta;
  return (data as Cliente[] | null) ?? [];
}

export async function obterCliente(id: string): Promise<Dono | null> {
  if (!isSupabaseConfigured) return id === DEMO.dono.id ? DEMO.dono : null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("perfis").select("id, nome, email, telefone").eq("id", id).maybeSingle();
  return data;
}

export async function contarPainel() {
  if (!isSupabaseConfigured) return { clientes: 1, veiculos: DEMO.veiculos.length, abertos: 1, respostas: 0 };
  const supabase = await createClient();
  const [c, v, a, r] = await Promise.all([
    supabase.from("perfis").select("id", { count: "exact", head: true }).eq("papel", "cliente"),
    supabase.from("veiculos").select("id", { count: "exact", head: true }),
    supabase.from("apontamentos").select("id", { count: "exact", head: true }).in("situacao", ["pendente", "orcamento", "agendamento", "agendado"]),
    supabase.from("apontamentos").select("id", { count: "exact", head: true }).in("situacao", ["orcamento", "agendamento"]),
  ]);
  return { clientes: c.count ?? 0, veiculos: v.count ?? 0, abertos: a.count ?? 0, respostas: r.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Apontamentos
// ---------------------------------------------------------------------------
const CAMPOS_APONTAMENTO =
  "id, veiculo_id, categoria, titulo, descricao, prioridade, fotos, situacao, mensagem_cliente, respondido_em, criado_em";

export async function listarApontamentos(veiculoIds: string[]): Promise<Apontamento[]> {
  if (veiculoIds.length === 0) return [];
  if (!isSupabaseConfigured) return DEMO.apontamentos.filter((a) => veiculoIds.includes(a.veiculo_id));
  const supabase = await createClient();
  const { data } = await supabase
    .from("apontamentos")
    .select(CAMPOS_APONTAMENTO)
    .in("veiculo_id", veiculoIds)
    .order("criado_em", { ascending: false });
  return (data as Apontamento[] | null) ?? [];
}

export async function obterApontamento(id: string): Promise<Apontamento | null> {
  if (!isSupabaseConfigured) return DEMO.apontamentos.find((a) => a.id === id) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("apontamentos").select(CAMPOS_APONTAMENTO).eq("id", id).maybeSingle();
  return (data as Apontamento | null) ?? null;
}

export type ItemCaixa = Apontamento & {
  veiculo: { id: string; placa: string; marca: string; modelo: string; apelido: string | null; dono: Dono | null } | null;
};

/** Apontamentos em que o cliente respondeu (orçamento/agendamento) ou que estão agendados. */
export async function caixaDeEntrada(): Promise<ItemCaixa[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("apontamentos")
    .select(
      `${CAMPOS_APONTAMENTO}, veiculo:veiculos (id, placa, marca, modelo, apelido, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone))`,
    )
    .in("situacao", ["orcamento", "agendamento", "agendado"])
    .order("respondido_em", { ascending: false, nullsFirst: false })
    .limit(50);
  return (data as unknown as ItemCaixa[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Documentos e vencimentos
// ---------------------------------------------------------------------------
const CAMPOS_DOCUMENTO = "id, dono_id, veiculo_id, tipo, descricao, vencimento";
const faltaTabela = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

export async function listarDocumentosVeiculos(veiculoIds: string[]): Promise<Documento[]> {
  if (veiculoIds.length === 0) return [];
  if (!isSupabaseConfigured) return DEMO.documentos.filter((d) => d.veiculo_id && veiculoIds.includes(d.veiculo_id));
  const supabase = await createClient();
  const { data, error } = await supabase.from("documentos").select(CAMPOS_DOCUMENTO).in("veiculo_id", veiculoIds).order("vencimento");
  if (faltaTabela(error)) return [];
  return (data as Documento[] | null) ?? [];
}

export async function obterCnh(usuarioId: string): Promise<Documento | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos")
    .select(CAMPOS_DOCUMENTO)
    .eq("dono_id", usuarioId)
    .eq("tipo", "cnh")
    .is("veiculo_id", null)
    .maybeSingle();
  return (data as Documento | null) ?? null;
}

export type Vencimento = {
  chave: string;
  titulo: string;
  data: string | null;
  detalhe: string;
  vencido: boolean;
  veiculo: { id: string; placa: string; nome: string } | null;
  cliente: Dono | null;
};

/** Painel: manutenções e documentos de todos os clientes vencidos ou vencendo em 30 dias. */
export async function vencimentosProximos(): Promise<Vencimento[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const hoje = hojeISO();
  const limite = somarMeses(hoje, 1);
  const veic = "veiculo:veiculos (id, placa, marca, modelo, apelido, km_atual, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone))";

  const [m, d] = await Promise.all([
    supabase.from("manutencoes").select(`id, tipo, proxima_data, proximo_km, ${veic}`).limit(500),
    supabase
      .from("documentos")
      .select(`id, tipo, descricao, vencimento, dono:perfis!documentos_dono_id_fkey (id, nome, email, telefone), ${veic}`)
      .lte("vencimento", limite)
      .order("vencimento")
      .limit(200),
  ]);

  type V = { id: string; placa: string; marca: string; modelo: string; apelido: string | null; km_atual: number; dono: Dono | null } | null;
  const nome = (v: NonNullable<V>) => v.apelido || `${v.marca} ${v.modelo}`.trim();
  const lista: Vencimento[] = [];

  for (const x of (m.data ?? []) as unknown as { id: string; tipo: string; proxima_data: string | null; proximo_km: number | null; veiculo: V }[]) {
    if (!x.veiculo) continue;
    const s = situacaoManutencao(x, x.veiculo.km_atual, hoje);
    if (s.situacao !== "vencida" && s.situacao !== "em_breve") continue;
    lista.push({
      chave: `m-${x.id}`,
      titulo: rotuloManutencao(x.tipo),
      data: x.proxima_data,
      detalhe: [x.proxima_data && `até ${x.proxima_data.split("-").reverse().join("/")}`, x.proximo_km != null && `${x.proximo_km.toLocaleString("pt-BR")} km`].filter(Boolean).join(" ou "),
      vencido: s.situacao === "vencida",
      veiculo: { id: x.veiculo.id, placa: x.veiculo.placa, nome: nome(x.veiculo) },
      cliente: x.veiculo.dono,
    });
  }
  if (!faltaTabela(d.error)) {
    for (const x of (d.data ?? []) as unknown as { id: string; tipo: keyof typeof TIPOS_DOCUMENTO; descricao: string | null; vencimento: string; dono: Dono | null; veiculo: V }[]) {
      lista.push({
        chave: `d-${x.id}`,
        titulo: x.tipo === "outro" && x.descricao ? x.descricao : TIPOS_DOCUMENTO[x.tipo].rotulo,
        data: x.vencimento,
        detalhe: `vence ${x.vencimento.split("-").reverse().join("/")}`,
        vencido: x.vencimento < hoje,
        veiculo: x.veiculo ? { id: x.veiculo.id, placa: x.veiculo.placa, nome: nome(x.veiculo) } : null,
        cliente: x.dono,
      });
    }
  }
  return lista.sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.data ?? "9999").localeCompare(b.data ?? "9999"));
}

// ---------------------------------------------------------------------------
// Orçamentos
// ---------------------------------------------------------------------------
const CAMPOS_ORCAMENTO =
  "id, numero, veiculo_id, apontamento_id, categoria, pedido, fotos, situacao, itens, valor_total, prazo_dias, validade, observacoes, motivo_recusa, respondido_em, decidido_em, criado_em";

export type OrcamentoComVeiculo = Orcamento & {
  veiculo: { id: string; dono_id: string; placa: string; marca: string; modelo: string; apelido: string | null; dono: Dono | null } | null;
};
const COM_VEICULO = `${CAMPOS_ORCAMENTO}, veiculo:veiculos (id, dono_id, placa, marca, modelo, apelido, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone))`;

/** Orçamentos dos veículos informados. */
export async function listarOrcamentos(veiculoIds: string[]): Promise<OrcamentoComVeiculo[]> {
  if (veiculoIds.length === 0) return [];
  if (!isSupabaseConfigured) return DEMO.orcamentos.filter((o) => veiculoIds.includes(o.veiculo_id)) as OrcamentoComVeiculo[];
  const supabase = await createClient();
  const { data, error } = await supabase.from("orcamentos").select(COM_VEICULO).in("veiculo_id", veiculoIds).order("criado_em", { ascending: false });
  if (faltaTabela(error)) return [];
  return (data as unknown as OrcamentoComVeiculo[] | null) ?? [];
}

/** Empresa: todos os orçamentos, filtrando pela situação. */
export async function listarOrcamentosEmpresa(situacoes?: string[]): Promise<OrcamentoComVeiculo[]> {
  if (!isSupabaseConfigured) return DEMO.orcamentos as OrcamentoComVeiculo[];
  const supabase = await createClient();
  let q = supabase.from("orcamentos").select(COM_VEICULO).order("criado_em", { ascending: false }).limit(100);
  if (situacoes?.length) q = q.in("situacao", situacoes);
  const { data, error } = await q;
  if (faltaTabela(error)) return [];
  return (data as unknown as OrcamentoComVeiculo[] | null) ?? [];
}

export async function obterOrcamento(id: string): Promise<OrcamentoComVeiculo | null> {
  if (!isSupabaseConfigured) return (DEMO.orcamentos.find((o) => o.id === id) as OrcamentoComVeiculo | undefined) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("orcamentos").select(COM_VEICULO).eq("id", id).maybeSingle();
  return (data as unknown as OrcamentoComVeiculo | null) ?? null;
}

export async function contarOrcamentosAResponder(): Promise<number> {
  if (!isSupabaseConfigured) return 1;
  const supabase = await createClient();
  const { count } = await supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("situacao", "solicitado");
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------
const CAMPOS_AGENDAMENTO =
  "id, veiculo_id, tipo, servico, categoria, situacao, inicio, fim, preferencias, observacoes, resposta, orcamento_id, apontamento_id, google_evento_id, criado_em";
export type AgendamentoComVeiculo = Agendamento & {
  veiculo: { id: string; dono_id: string; placa: string; marca: string; modelo: string; apelido: string | null; dono: Dono | null } | null;
};
const AG_COM_VEICULO = `${CAMPOS_AGENDAMENTO}, veiculo:veiculos (id, dono_id, placa, marca, modelo, apelido, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone))`;

export async function listarAgendamentos(veiculoIds: string[]): Promise<AgendamentoComVeiculo[]> {
  if (veiculoIds.length === 0) return [];
  if (!isSupabaseConfigured) return DEMO.agendamentos.filter((a) => veiculoIds.includes(a.veiculo_id)) as AgendamentoComVeiculo[];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agendamentos")
    .select(AG_COM_VEICULO)
    .in("veiculo_id", veiculoIds)
    .order("criado_em", { ascending: false })
    .limit(50);
  if (faltaTabela(error)) return [];
  return (data as unknown as AgendamentoComVeiculo[] | null) ?? [];
}

/** Empresa: pedidos a confirmar e próximos confirmados. */
export async function agendaEmpresa(): Promise<{ aConfirmar: AgendamentoComVeiculo[]; proximos: AgendamentoComVeiculo[] }> {
  if (!isSupabaseConfigured) {
    const todos = DEMO.agendamentos as AgendamentoComVeiculo[];
    return { aConfirmar: todos.filter((a) => a.situacao === "solicitado"), proximos: todos.filter((a) => a.situacao === "confirmado") };
  }
  const supabase = await createClient();
  const inicioHoje = new Date(`${hojeISO()}T00:00:00-03:00`).toISOString();
  const [a, p] = await Promise.all([
    supabase.from("agendamentos").select(AG_COM_VEICULO).eq("situacao", "solicitado").order("criado_em"),
    supabase.from("agendamentos").select(AG_COM_VEICULO).eq("situacao", "confirmado").gte("inicio", inicioHoje).order("inicio").limit(100),
  ]);
  if (faltaTabela(a.error)) return { aConfirmar: [], proximos: [] };
  return {
    aConfirmar: (a.data as unknown as AgendamentoComVeiculo[] | null) ?? [],
    proximos: (p.data as unknown as AgendamentoComVeiculo[] | null) ?? [],
  };
}

export async function obterAgendamento(id: string): Promise<AgendamentoComVeiculo | null> {
  if (!isSupabaseConfigured) return (DEMO.agendamentos.find((a) => a.id === id) as AgendamentoComVeiculo | undefined) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("agendamentos").select(AG_COM_VEICULO).eq("id", id).maybeSingle();
  return (data as unknown as AgendamentoComVeiculo | null) ?? null;
}

export async function contarAgendamentosAConfirmar(): Promise<number> {
  if (!isSupabaseConfigured) return 1;
  const supabase = await createClient();
  const { count } = await supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("situacao", "solicitado");
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Avisos (central de notificações)
// ---------------------------------------------------------------------------
export type Notificacao = { id: string; titulo: string; corpo: string | null; link: string | null; lida_em: string | null; criado_em: string };

export async function listarNotificacoes(usuarioId: string): Promise<Notificacao[]> {
  if (!isSupabaseConfigured) return DEMO.notificacoes;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notificacoes")
    .select("id, titulo, corpo, link, lida_em, criado_em")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function contarNaoLidas(usuarioId: string): Promise<number> {
  if (!isSupabaseConfigured) return DEMO.notificacoes.filter((n) => !n.lida_em).length;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .is("lida_em", null);
  return count ?? 0;
}

function ehUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ---------------------------------------------------------------------------
// Dados de demonstração (usados só enquanto o banco não está conectado)
// ---------------------------------------------------------------------------
const hoje = hojeISO();
const DEMO = {
  dono: { id: "demo", nome: "Cliente Demonstração", email: "demo@semprezero.app", telefone: "(11) 90000-0000" },
  veiculos: [
    {
      id: "demo-civic",
      dono_id: "demo",
      placa: "BRA2E19",
      marca: "Honda",
      modelo: "Civic EXL",
      ano: 2021,
      cor: "Prata",
      apelido: null,
      km_atual: 48200,
      km_atualizado_em: `${hoje}T12:00:00Z`,
      foto: null,
    },
  ] satisfies Veiculo[],
  servicos: [
    {
      id: "demo-s1",
      veiculo_id: "demo-civic",
      data: somarMeses(hoje, -2),
      categoria: "estetica",
      titulo: "Polimento técnico e vitrificação",
      descricao: "Polimento em 3 etapas e aplicação de vitrificação cerâmica.",
      km: 47100,
      valor: 1800,
      prestador: "proprio",
      fotos: [],
      pela_empresa: true,
    },
    {
      id: "demo-s2",
      veiculo_id: "demo-civic",
      data: somarMeses(hoje, -11),
      categoria: "mecanica",
      titulo: "Troca de óleo e filtro",
      descricao: "Óleo 0W-20 sintético.",
      km: 39000,
      valor: 420,
      prestador: "terceirizado",
      fotos: [],
      pela_empresa: true,
    },
  ] satisfies Servico[],
  manutencoes: [
    {
      id: "demo-m1",
      veiculo_id: "demo-civic",
      tipo: "oleo",
      ultima_data: somarMeses(hoje, -11),
      ultimo_km: 39000,
      intervalo_meses: 12,
      intervalo_km: 10000,
      proxima_data: somarMeses(hoje, 1),
      proximo_km: 49000,
      definido_pela_empresa: true,
    },
    {
      id: "demo-m2",
      veiculo_id: "demo-civic",
      tipo: "protecao_pintura",
      ultima_data: somarMeses(hoje, -2),
      ultimo_km: 47100,
      intervalo_meses: 6,
      intervalo_km: null,
      proxima_data: somarMeses(hoje, 4),
      proximo_km: null,
      definido_pela_empresa: true,
    },
  ] satisfies Manutencao[],
  apontamentos: [
    {
      id: "demo-a1",
      veiculo_id: "demo-civic",
      categoria: "funilaria_pintura",
      titulo: "Risco na porta traseira direita",
      descricao: "Risco profundo, chegou no primer. Recomendamos repintura localizada para evitar oxidação.",
      prioridade: "media",
      fotos: [],
      situacao: "pendente",
      mensagem_cliente: null,
      respondido_em: null,
      criado_em: `${hoje}T13:00:00Z`,
    },
  ] satisfies Apontamento[],
  documentos: [
    { id: "demo-d1", dono_id: "demo", veiculo_id: "demo-civic", tipo: "licenciamento", descricao: null, vencimento: somarMeses(hoje, 2) },
    { id: "demo-d2", dono_id: "demo", veiculo_id: "demo-civic", tipo: "seguro", descricao: "Porto Seguro", vencimento: somarDias(hoje, 12) },
  ] satisfies Documento[],
  orcamentos: [
    {
      id: "demo-o1",
      numero: 7,
      veiculo_id: "demo-civic",
      apontamento_id: null,
      categoria: "estetica",
      pedido: "Gostaria de um orçamento para higienização interna completa e hidratação dos bancos de couro.",
      fotos: [],
      situacao: "respondido",
      itens: [
        { descricao: "Higienização interna completa", valor: 350 },
        { descricao: "Hidratação dos bancos de couro", valor: 180 },
      ],
      valor_total: 530,
      prazo_dias: 1,
      validade: somarDias(hoje, 15),
      observacoes: "Serviço feito em 1 dia. Retire o carro no fim da tarde.",
      motivo_recusa: null,
      respondido_em: `${hoje}T14:00:00Z`,
      decidido_em: null,
      criado_em: `${hoje}T12:00:00Z`,
      veiculo: { id: "demo-civic", dono_id: "demo", placa: "BRA2E19", marca: "Honda", modelo: "Civic EXL", apelido: null, dono: { id: "demo", nome: "Cliente Demonstração", email: "demo@semprezero.app", telefone: "(11) 90000-0000" } },
    },
  ] satisfies (Orcamento & { veiculo: unknown })[],
  agendamentos: [
    {
      id: "demo-ag1",
      veiculo_id: "demo-civic",
      tipo: "lavagem",
      servico: "Lavagem",
      categoria: "estetica",
      situacao: "confirmado",
      inicio: `${somarDias(hoje, 2)}T13:00:00.000Z`,
      fim: `${somarDias(hoje, 2)}T14:00:00.000Z`,
      preferencias: [],
      observacoes: null,
      resposta: null,
      orcamento_id: null,
      apontamento_id: null,
      google_evento_id: null,
      criado_em: `${hoje}T12:00:00Z`,
      veiculo: { id: "demo-civic", dono_id: "demo", placa: "BRA2E19", marca: "Honda", modelo: "Civic EXL", apelido: null, dono: { id: "demo", nome: "Cliente Demonstração", email: "demo@semprezero.app", telefone: "(11) 90000-0000" } },
    },
    {
      id: "demo-ag2",
      veiculo_id: "demo-civic",
      tipo: "servico",
      servico: "Repintura da porta traseira direita",
      categoria: "funilaria_pintura",
      situacao: "solicitado",
      inicio: null,
      fim: null,
      preferencias: [{ data: somarDias(hoje, 4), periodo: "manha" }, { data: somarDias(hoje, 5), periodo: "qualquer" }],
      observacoes: "Prefiro deixar o carro cedo.",
      resposta: null,
      orcamento_id: null,
      apontamento_id: "demo-a1",
      google_evento_id: null,
      criado_em: `${hoje}T12:30:00Z`,
      veiculo: { id: "demo-civic", dono_id: "demo", placa: "BRA2E19", marca: "Honda", modelo: "Civic EXL", apelido: null, dono: { id: "demo", nome: "Cliente Demonstração", email: "demo@semprezero.app", telefone: "(11) 90000-0000" } },
    },
  ] satisfies (Agendamento & { veiculo: unknown })[],
  notificacoes: [
    {
      id: "demo-n1",
      titulo: "Novo apontamento no seu Honda Civic EXL",
      corpo: "Risco na porta traseira direita — Recomendado",
      link: "/garagem/demo-civic/apontamentos/demo-a1",
      lida_em: null,
      criado_em: `${hoje}T13:00:00Z`,
    },
  ] satisfies Notificacao[],
};
