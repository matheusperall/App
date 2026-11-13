import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Agendamento } from "@/lib/agenda";
import { documentosAutomaticos } from "@/lib/calendarios";
import { TIPOS_DOCUMENTO, type Anexo, ritmoDoVeiculo, hojeISO, rotuloManutencao, somarDias, somarMeses, situacaoManutencao, type Apontamento, type Documento, type LeituraKm, type Orcamento, type Manutencao, type Servico, type Veiculo, type Porte } from "@/lib/garagem";

// Todas as leituras passam pelo Supabase com a sessão do usuário,
// então as regras de segurança do banco (RLS) decidem o que cada um vê.

export type Dono = { id: string; nome: string; email: string | null; telefone: string | null };
export type VeiculoComDono = Veiculo & { dono: Dono | null };

const CAMPOS_BASICOS =
  "id, dono_id, placa, marca, modelo, ano, cor, apelido, km_atual, km_atualizado_em, foto";
const CAMPOS_VEICULO = `${CAMPOS_BASICOS}, tipo, combustivel, codigo_fipe, valor_fipe, fipe_referencia, fipe_marca_cod, fipe_modelo_cod, fipe_ano_cod, km_por_dia, uf`;
/** Com a ficha do cliente na loja (gestão, 0010). */
const CAMPOS_VEICULO_FICHA = `${CAMPOS_VEICULO}, cliente_id`;
/** Com as preferências do cliente (0017). */
const CAMPOS_VEICULO_PREF = `${CAMPOS_VEICULO_FICHA}, preferencias`;
/** Com o tamanho do veículo (0020). */
const CAMPOS_VEICULO_PORTE = `${CAMPOS_VEICULO_PREF}, porte`;

/** Se o banco ainda não recebeu as colunas da FIPE (0004), consulta só as básicas. */
const faltaColuna = (e: { code?: string } | null) => e?.code === "42703";

export async function listarVeiculos(donoId: string): Promise<Veiculo[]> {
  if (!isSupabaseConfigured) return DEMO.veiculos.filter((v) => v.dono_id === donoId);
  const supabase = await createClient();
  const consulta = (campos: string) =>
    supabase.from("veiculos").select(campos).eq("dono_id", donoId).order("criado_em");
  let { data, error } = await consulta(CAMPOS_VEICULO_PORTE);
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_VEICULO_PREF));
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_VEICULO_FICHA));
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_VEICULO));
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_BASICOS));
  return (data as unknown as Veiculo[] | null) ?? [];
}

/** Tamanho de cada veículo (id → porte). Sem a migração 0020, volta vazio. */
export async function portesDosVeiculos(ids?: string[]): Promise<Record<string, Porte>> {
  if (!isSupabaseConfigured) return Object.fromEntries(DEMO.veiculos.filter((v) => v.porte).map((v) => [v.id, v.porte as Porte]));
  if (ids && ids.length === 0) return {};
  const supabase = await createClient();
  let q = supabase.from("veiculos").select("id, porte").not("porte", "is", null);
  if (ids) q = q.in("id", ids.filter(ehUuid));
  const { data, error } = await q;
  if (error) return {};
  return Object.fromEntries(((data ?? []) as { id: string; porte: Porte }[]).map((v) => [v.id, v.porte]));
}

/** Preferências de cada veículo (id → lista). Sem a migração 0017, volta vazio. */
export async function preferenciasDosVeiculos(ids?: string[]): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured) return Object.fromEntries(DEMO.veiculos.map((v) => [v.id, v.preferencias ?? []]));
  if (ids && ids.length === 0) return {};
  const supabase = await createClient();
  let q = supabase.from("veiculos").select("id, preferencias");
  if (ids) q = q.in("id", ids.filter(ehUuid));
  const { data, error } = await q;
  if (error) return {};
  return Object.fromEntries(((data ?? []) as { id: string; preferencias: string[] | null }[]).filter((v) => v.preferencias?.length).map((v) => [v.id, v.preferencias ?? []]));
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
  let { data, error } = await consulta(`${CAMPOS_VEICULO_PORTE}, ficha:clientes (id, nome, email, telefone)`);
  if (error) ({ data, error } = await consulta(`${CAMPOS_VEICULO_PREF}, ficha:clientes (id, nome, email, telefone)`));
  if (error) ({ data, error } = await consulta(`${CAMPOS_VEICULO_FICHA}, ficha:clientes (id, nome, email, telefone)`));
  if (error) ({ data, error } = await consulta(CAMPOS_VEICULO));
  if (faltaColuna(error)) ({ data, error } = await consulta(CAMPOS_BASICOS));
  const v = data as unknown as (VeiculoComDono & { ficha?: Dono | null }) | null;
  if (!v) return null;
  // Cliente sem login: os dados vêm da ficha da loja
  const { ficha, ...resto } = v;
  return { ...resto, dono: v.dono ?? ficha ?? null };
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
  const veic = "veiculo:veiculos (id, placa, marca, modelo, apelido, km_atual, km_atualizado_em, km_por_dia, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone))";

  const [m, d] = await Promise.all([
    supabase.from("manutencoes").select(`id, tipo, proxima_data, proximo_km, ${veic}`).limit(500),
    supabase
      .from("documentos")
      .select(`id, tipo, descricao, vencimento, dono:perfis!documentos_dono_id_fkey (id, nome, email, telefone), ${veic}`)
      .lte("vencimento", limite)
      .order("vencimento")
      .limit(200),
  ]);

  type V = { id: string; placa: string; marca: string; modelo: string; apelido: string | null; km_atual: number; km_atualizado_em: string; km_por_dia?: number | null; dono: Dono | null } | null;
  const nome = (v: NonNullable<V>) => v.apelido || `${v.marca} ${v.modelo}`.trim();
  const lista: Vencimento[] = [];

  for (const x of (m.data ?? []) as unknown as { id: string; tipo: string; proxima_data: string | null; proximo_km: number | null; veiculo: V }[]) {
    if (!x.veiculo) continue;
    const s = situacaoManutencao(x, x.veiculo.km_atual, hoje, ritmoDoVeiculo(x.veiculo));
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
  // IPVA e licenciamento pelo calendário (veículos de SP sem data informada)
  {
    const buscarVeiculos = (uf: boolean) =>
      supabase
        .from("veiculos")
        .select(`id, dono_id, placa, marca, modelo, apelido${uf ? ", uf" : ""}, dono:perfis!veiculos_dono_id_fkey (id, nome, email, telefone)`)
        .limit(1000);
    let cv: { data: unknown[] | null; error: { code?: string } | null } = await buscarVeiculos(true);
    if (cv.error?.code === "42703") cv = await buscarVeiculos(false);
    const manuais = (d.data ?? []) as unknown as { tipo: string; veiculo: { id: string } | null }[];
    const { data: todosManuais } = await supabase.from("documentos").select("tipo, veiculo_id").in("tipo", ["licenciamento", "ipva"]);
    for (const v of (cv.data ?? []) as unknown as { id: string; dono_id: string; placa: string; marca: string; modelo: string; apelido: string | null; uf?: string; dono: Dono | null }[]) {
      for (const a of documentosAutomaticos(v, [...(todosManuais ?? []), ...manuais.map((m) => ({ tipo: m.tipo, veiculo_id: m.veiculo?.id ?? null }))], hoje)) {
        if (a.vencimento > limite) continue;
        lista.push({
          chave: a.id,
          titulo: a.tipo === "ipva" ? `IPVA ${a.descricao.split(" · ")[0]}` : `Licenciamento ${a.descricao.split(" · ")[0]}`,
          data: a.vencimento,
          detalhe: `${a.tipo === "ipva" ? a.descricao.split(" · ")[1] : "pelo final da placa"} · ${a.vencimento.split("-").reverse().join("/")}`,
          vencido: false,
          veiculo: { id: v.id, placa: v.placa, nome: v.apelido || `${v.marca} ${v.modelo}`.trim() },
          cliente: v.dono,
        });
      }
    }
  }
  return lista.sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.data ?? "9999").localeCompare(b.data ?? "9999"));
}

/** Arquivos anexados de um veículo, ou os pessoais (CNH) de quem tem conta. Com links temporários (1 hora). */
export async function listarAnexos(filtro: { veiculoId: string } | { donoId: string }): Promise<Anexo[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let q = supabase.from("documentos_arquivos").select("id, tipo, nome, caminho, tamanho, tipo_mime, criado_em").order("criado_em", { ascending: false }).limit(100);
  q = "veiculoId" in filtro ? q.eq("veiculo_id", filtro.veiculoId) : q.eq("dono_id", filtro.donoId).is("veiculo_id", null);
  const { data, error } = await q;
  if (error || !data?.length) return [];
  const { data: links } = await supabase.storage.from("documentos").createSignedUrls(data.map((a) => a.caminho), 3600);
  const mapa = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
  return data.map(({ caminho, ...a }) => ({ ...(a as Omit<Anexo, "url">), url: mapa.get(caminho) ?? undefined }));
}

export async function listarLeiturasKm(veiculoId: string): Promise<LeituraKm[]> {
  if (!isSupabaseConfigured) return DEMO.leituras;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leituras_km").select("km, data, origem").eq("veiculo_id", veiculoId).order("data");
  if (faltaTabela(error)) return [];
  return (data as LeituraKm[] | null) ?? [];
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

/** Empresa: agendamentos com horário num intervalo de dias (inclusive), sem recusados/cancelados. */
export async function agendamentosEntre(de: string, ate: string): Promise<AgendamentoComVeiculo[]> {
  if (!isSupabaseConfigured) return (DEMO.agendamentos as AgendamentoComVeiculo[]).filter((a) => a.situacao !== "recusado" && a.situacao !== "cancelado");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agendamentos")
    .select(AG_COM_VEICULO)
    .in("situacao", ["solicitado", "confirmado", "concluido"])
    .gte("inicio", new Date(`${de}T00:00:00-03:00`).toISOString())
    .lt("inicio", new Date(`${somarDias(ate, 1)}T00:00:00-03:00`).toISOString())
    .order("inicio")
    .limit(500);
  if (faltaTabela(error)) return [];
  return (data as unknown as AgendamentoComVeiculo[] | null) ?? [];
}

/** Empresa: últimos agendamentos (para a busca da Agenda). */
export async function ultimosAgendamentos(limite = 300): Promise<AgendamentoComVeiculo[]> {
  if (!isSupabaseConfigured) return DEMO.agendamentos as AgendamentoComVeiculo[];
  const supabase = await createClient();
  const { data, error } = await supabase.from("agendamentos").select(AG_COM_VEICULO).order("criado_em", { ascending: false }).limit(limite);
  if (faltaTabela(error)) return [];
  return (data as unknown as AgendamentoComVeiculo[] | null) ?? [];
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
      km_por_dia: 27.0,
      preferencias: ["Não mexer nos bancos", "Pretinho semi brilho"],
      porte: "medio" as Porte,
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
    { id: "demo-d2", dono_id: "demo", veiculo_id: "demo-civic", tipo: "seguro", descricao: "Porto Seguro", vencimento: somarDias(hoje, 12) },
  ] satisfies Documento[],
  leituras: [
    { km: 39000, data: somarMeses(hoje, -11), origem: "servico" },
    { km: 47100, data: somarMeses(hoje, -2), origem: "servico" },
    { km: 48200, data: hoje, origem: "cliente" },
  ] satisfies LeituraKm[],
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
