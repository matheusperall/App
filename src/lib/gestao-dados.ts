import "server-only";
import { ehChaveMensagem, type ModelosSalvos } from "@/lib/mensagens";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, somarDias } from "@/lib/garagem";
import {
  CONFIG_PADRAO,
  arred,
  combina,
  concluida,
  faturaEmAberto,
  datasDaFatura,
  faturaDaCompra,
  faltaReceber,
  formatarQtd,
  limitesMes,
  noPatio,
  type CategoriaFinanceira,
  type ConfigGestao,
  type Cartao,
  type Conta,
  type Fatura,
  type Ficha,
  type FichaComResumo,
  type ItemFatura,
  type Lancamento,
  type MovimentoEstoque,
  type OrdemServico,
  type PagamentoFatura,
  type PagamentoOS,
  type Produto,
  type ServicoCatalogo,
  type VeiculoResumo,
} from "@/lib/gestao";

// Leituras da gestão. Tudo passa pela sessão do usuário: as regras do banco (RLS)
// garantem que só o administrador enxergue estes dados.

const n = (v: unknown) => (v == null ? 0 : Number(v));
const ehUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const obterConfig = cache(async function obterConfig(): Promise<ConfigGestao> {
  if (!isSupabaseConfigured) return CONFIG_PADRAO;
  const supabase = await createClient();
  const { data } = await supabase.from("gestao_config").select("vagas_patio, taxa_debito, taxa_credito").maybeSingle();
  if (!data) return CONFIG_PADRAO;
  return { vagas_patio: n(data.vagas_patio), taxa_debito: n(data.taxa_debito), taxa_credito: n(data.taxa_credito) };
});

/** Modelos de mensagem de WhatsApp editados pela empresa (0018). Sem a migração, volta vazio (usa os padrões). */
export const obterModelosMensagens = cache(async function obterModelosMensagens(): Promise<ModelosSalvos> {
  if (!isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("gestao_config").select("mensagens").maybeSingle();
  if (error || !data?.mensagens || typeof data.mensagens !== "object") return {};
  return Object.fromEntries(Object.entries(data.mensagens as Record<string, unknown>).filter(([k, v]) => ehChaveMensagem(k) && typeof v === "string")) as ModelosSalvos;
});

// ---------------------------------------------------------------------------
// Clientes (fichas)
// ---------------------------------------------------------------------------
const CAMPOS_FICHA = "id, perfil_id, nome, telefone, email, lojista, observacoes, criado_em";
const CAMPOS_VEIC = "id, placa, marca, modelo, apelido, ano, dono_id";

/** Fichas da loja (sem a conta do administrador), com veículos e resumo de gastos. */
export const listarFichas = cache(async function listarFichas(busca = ""): Promise<FichaComResumo[]> {
  if (!isSupabaseConfigured) return DEMO.fichas.filter((f) => !busca || combina(`${f.nome} ${f.veiculos.map((v) => v.placa).join(" ")}`, busca));
  const supabase = await createClient();
  const [{ data }, { data: resumo }, { data: admins }] = await Promise.all([
    supabase.from("clientes").select(`${CAMPOS_FICHA}, veiculos (${CAMPOS_VEIC})`).order("nome").limit(2000),
    supabase.from("gestao_resumo_clientes").select("cliente_id, total_gasto, ultima_visita, qtd_os").limit(5000),
    supabase.from("perfis").select("id").eq("papel", "admin"),
  ]);
  const adminIds = new Set((admins ?? []).map((a) => a.id));
  const porCliente = new Map((resumo ?? []).map((r) => [r.cliente_id as string, r]));
  const lista = ((data ?? []) as unknown as (Ficha & { veiculos: VeiculoResumo[] })[])
    .filter((f) => !f.perfil_id || !adminIds.has(f.perfil_id))
    .map((f) => {
      const r = porCliente.get(f.id);
      return { ...f, total_gasto: n(r?.total_gasto), ultima_visita: (r?.ultima_visita as string | null) ?? null, qtd_os: n(r?.qtd_os) };
    });
  if (!busca.trim()) return lista;
  const placa = busca.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return lista.filter(
    (f) =>
      combina(`${f.nome} ${f.telefone ?? ""} ${f.email ?? ""}`, busca) ||
      (placa.length >= 3 && f.veiculos.some((v) => v.placa.includes(placa))),
  );
});

/** Ficha pelo id dela ou pelo id da conta do app (links antigos usam a conta). */
export const obterFicha = cache(async function obterFicha(id: string): Promise<(Ficha & { veiculos: VeiculoResumo[] }) | null> {
  if (!isSupabaseConfigured) return DEMO.fichas.find((f) => f.id === id || f.perfil_id === id) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const sel = `${CAMPOS_FICHA}, veiculos (${CAMPOS_VEIC})`;
  const { data } = await supabase.from("clientes").select(sel).eq("id", id).maybeSingle();
  if (data) return data as unknown as Ficha & { veiculos: VeiculoResumo[] };
  const { data: porPerfil } = await supabase.from("clientes").select(sel).eq("perfil_id", id).maybeSingle();
  return (porPerfil as unknown as (Ficha & { veiculos: VeiculoResumo[] }) | null) ?? null;
});

// ---------------------------------------------------------------------------
// Catálogo e estoque
// ---------------------------------------------------------------------------
export const listarCatalogo = cache(async function listarCatalogo(): Promise<ServicoCatalogo[]> {
  if (!isSupabaseConfigured) return DEMO.catalogo;
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_servicos")
    .select("id, nome, preco, categoria, ativo, consumo:catalogo_consumo (produto_id, quantidade, produto:produtos (nome, unidade, custo_medio))")
    .order("nome");
  return ((data ?? []) as unknown as ServicoCatalogo[]).map((s) => ({
    ...s,
    preco: n(s.preco),
    consumo: s.consumo.map((c) => ({ ...c, quantidade: n(c.quantidade), produto: c.produto ? { ...c.produto, custo_medio: n(c.produto.custo_medio) } : null })),
  }));
});

export const listarProdutos = cache(async function listarProdutos(): Promise<Produto[]> {
  if (!isSupabaseConfigured) return DEMO.produtos;
  const supabase = await createClient();
  const { data } = await supabase.from("produtos").select("id, nome, unidade, saldo, minimo, custo_medio, ativo").order("nome");
  return ((data ?? []) as Produto[]).map((p) => ({ ...p, saldo: n(p.saldo), minimo: n(p.minimo), custo_medio: n(p.custo_medio) }));
});

export async function movimentosEstoque(produtoId?: string): Promise<(MovimentoEstoque & { produto: { nome: string; unidade: Produto["unidade"] } | null })[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let q = supabase
    .from("estoque_movimentos")
    .select("id, produto_id, criado_em, tipo, quantidade, custo_unitario, saldo_apos, origem, os_id, observacao, produto:produtos (nome, unidade)")
    .order("criado_em", { ascending: false })
    .limit(100);
  if (produtoId) q = q.eq("produto_id", produtoId);
  const { data } = await q;
  return ((data ?? []) as unknown as (MovimentoEstoque & { produto: { nome: string; unidade: Produto["unidade"] } | null })[]).map((m) => ({
    ...m,
    quantidade: n(m.quantidade),
    custo_unitario: n(m.custo_unitario),
    saldo_apos: n(m.saldo_apos),
  }));
}

// ---------------------------------------------------------------------------
// Ordens de serviço
// ---------------------------------------------------------------------------
const CAMPOS_OS =
  "id, numero, cliente_id, veiculo_id, placa, veiculo_nome, data, status, km, observacoes, subtotal, desconto, total, pago, pago_em, forma_pagamento, conta_id, taxa_valor, fatura_id, custo_produtos, estoque_baixado, agendamento_id, orcamento_id, pronta_em, entregue_em, criado_em, itens:os_itens (id, catalogo_id, nome, preco, ordem), cliente:clientes (id, nome, telefone, lojista, perfil_id)";

/** O banco já tem os pagamentos divididos (0013)? Consultado uma vez por requisição. */
const temPagamentosOS = cache(async function temPagamentosOS() {
  const supabase = await createClient();
  const { error } = await supabase.from("ordens_servico").select("valor_pago").limit(1);
  return !error;
});
async function camposOS() {
  return (await temPagamentosOS()) ? `${CAMPOS_OS}, parcelas, valor_pago` : CAMPOS_OS;
}

function normalizarOS(o: OrdemServico): OrdemServico {
  return {
    ...o,
    numero: n(o.numero),
    subtotal: n(o.subtotal),
    desconto: n(o.desconto),
    total: n(o.total),
    valor_pago: o.valor_pago == null ? (o.pago ? n(o.total) : 0) : n(o.valor_pago),
    taxa_valor: n(o.taxa_valor),
    custo_produtos: n(o.custo_produtos),
    itens: [...(o.itens ?? [])].map((i) => ({ ...i, preco: n(i.preco) })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
  };
}

export type FiltroOS = "patio" | "receber" | "lojistas" | "todas";

export async function listarOS(opcoes: { filtro: FiltroOS; mes: string; busca?: string; clienteId?: string }): Promise<OrdemServico[]> {
  const { filtro, mes, busca = "", clienteId } = opcoes;
  let lista: OrdemServico[];
  if (!isSupabaseConfigured) {
    lista = DEMO.os;
  } else {
    const supabase = await createClient();
    let q = supabase.from("ordens_servico").select(await camposOS()).order("data", { ascending: false }).order("numero", { ascending: false });
    if (clienteId) q = q.eq("cliente_id", clienteId).limit(300);
    else if (busca.trim()) q = q.limit(1000);
    else if (filtro === "patio") q = q.in("status", ["aberta", "em_andamento", "pronta"]);
    else if (filtro === "receber") q = q.eq("pago", false).in("status", ["pronta", "entregue"]);
    else {
      const { inicio, fim } = limitesMes(mes);
      q = q.gte("data", inicio).lte("data", fim);
    }
    const { data } = await q;
    lista = ((data ?? []) as unknown as OrdemServico[]).map(normalizarOS);
  }

  if (!clienteId) {
    if (filtro === "patio") lista = lista.filter((o) => noPatio(o.status));
    if (filtro === "receber") lista = lista.filter((o) => !o.pago && concluida(o.status));
    if (filtro === "lojistas") lista = lista.filter((o) => o.cliente?.lojista);
    if (!busca.trim() && (filtro === "todas" || filtro === "lojistas")) lista = lista.filter((o) => o.data.startsWith(mes));
  }
  if (busca.trim()) {
    const numero = busca.replace(/\D/g, "");
    const placa = busca.toUpperCase().replace(/[^A-Z0-9]/g, "");
    lista = lista.filter(
      (o) =>
        (numero && String(o.numero) === numero && /^#?\s*\d+$/.test(busca.trim())) ||
        (placa.length >= 3 && (o.placa ?? "").includes(placa)) ||
        combina(o.cliente?.nome ?? "", busca),
    );
  }
  return lista;
}

/** Produtos baixados do estoque por uma OS. */
export const consumoDaOS = cache(async function consumoDaOS(osId: string): Promise<{ texto: string; custo: number }[]> {
  if (!isSupabaseConfigured || !ehUuid(osId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("estoque_movimentos")
    .select("quantidade, custo_unitario, produto:produtos (nome, unidade)")
    .eq("os_id", osId)
    .eq("tipo", "baixa");
  return ((data ?? []) as unknown as { quantidade: number; custo_unitario: number; produto: { nome: string; unidade: Produto["unidade"] } | null }[]).map((m) => ({
    texto: `${m.produto?.nome ?? "Produto"}: ${formatarQtd(-n(m.quantidade), m.produto?.unidade ?? "un")}`,
    custo: arred(-n(m.quantidade) * n(m.custo_unitario)),
  }));
});

/** Pagamentos recebidos numa OS (pode ter vários). */
export const pagamentosDaOS = cache(async function pagamentosDaOS(osId: string): Promise<PagamentoOS[]> {
  if (!isSupabaseConfigured || !ehUuid(osId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("os_pagamentos").select("id, data, valor, forma, conta_id, parcelas, taxa_valor").eq("os_id", osId).order("criado_em");
  if (error) return [];
  return ((data ?? []) as PagamentoOS[]).map((p) => ({ ...p, valor: n(p.valor), taxa_valor: n(p.taxa_valor) }));
});

export const obterOS = cache(async function obterOS(id: string): Promise<OrdemServico | null> {
  if (!isSupabaseConfigured) return DEMO.os.find((o) => o.id === id) ?? null;
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ordens_servico").select(await camposOS()).eq("id", id).maybeSingle();
  return data ? normalizarOS(data as unknown as OrdemServico) : null;
});

/** OS ligadas a agendamentos/orçamentos (para mostrar "OS #12" em vez de "Abrir OS"). */
export async function osPorOrigem(campo: "agendamento_id" | "orcamento_id", ids: string[]): Promise<Record<string, { id: string; numero: number }>> {
  if (!isSupabaseConfigured || ids.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("ordens_servico").select(`id, numero, ${campo}`).in(campo, ids).neq("status", "cancelada");
  if (error) return {};
  const mapa: Record<string, { id: string; numero: number }> = {};
  for (const o of (data ?? []) as unknown as Record<string, string>[]) mapa[o[campo]] = { id: o.id, numero: Number(o.numero) };
  return mapa;
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------
const TODAS_FORMAS = ["pix", "dinheiro", "debito", "credito", "transferencia"] as const;

export const listarContas = cache(async function listarContas(): Promise<Conta[]> {
  if (!isSupabaseConfigured) return DEMO.contas;
  const supabase = await createClient();
  const consulta = (campos: string) => supabase.from("contas").select(campos).order("criado_em");
  const [primeira, { data: saldos }, config] = await Promise.all([
    consulta("id, nome, tipo, saldo_inicial, ativa, formas, taxa_pix, taxa_debito, taxa_credito, taxas_parcelado"),
    supabase.from("gestao_saldos_contas").select("conta_id, saldo"),
    obterConfig(),
  ]);
  let { data } = primeira;
  // Banco ainda sem o 0011: todas as formas e as taxas das configurações
  if (primeira.error?.code === "42703") ({ data } = await consulta("id, nome, tipo, saldo_inicial, ativa"));
  const mapa = new Map((saldos ?? []).map((s) => [s.conta_id as string, n(s.saldo)]));
  return ((data ?? []) as unknown as Partial<Conta>[]).map((c) => ({
    ...(c as Conta),
    saldo_inicial: n(c.saldo_inicial),
    saldo: mapa.get(c.id!) ?? n(c.saldo_inicial),
    formas: (c.formas ?? [...TODAS_FORMAS]) as Conta["formas"],
    taxa_pix: n(c.taxa_pix),
    taxa_debito: c.taxa_debito == null ? config.taxa_debito : n(c.taxa_debito),
    taxa_credito: c.taxa_credito == null ? config.taxa_credito : n(c.taxa_credito),
    taxas_parcelado: Object.fromEntries(Object.entries(c.taxas_parcelado ?? {}).map(([k, v]) => [k, n(v)])),
  }));
});

export const listarCategorias = cache(async function listarCategorias(): Promise<CategoriaFinanceira[]> {
  if (!isSupabaseConfigured) return DEMO.categorias;
  const supabase = await createClient();
  const { data } = await supabase.from("categorias_financeiras").select("id, nome, tipo, dre, sistema, ativa").order("nome");
  return (data ?? []) as CategoriaFinanceira[];
});

const CAMPOS_LANC = "id, data, vencimento, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id, fatura_id";
/** Série (recorrente/parcelado) — migração 0012 */
const CAMPOS_SERIE = ", grupo_id, parcela, total_parcelas, recorrente";
/** Compra no cartão de crédito — migração 0015 */
const CAMPOS_CARTAO = ", cartao_id, fatura_mes";
const normLanc = (l: Lancamento) => ({ ...l, valor: n(l.valor) });

type Supa = Awaited<ReturnType<typeof createClient>>;
/** Consulta lançamentos com os campos da série; se o banco ainda não tem o 0012, sem eles. */
async function consultarLancamentos(montar: (supabase: Supa, campos: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>) {
  const supabase = await createClient();
  // Tenta com os campos mais novos primeiro (cartão: 0015; série: 0012) e vai tirando se o banco não tiver
  for (const campos of [CAMPOS_LANC + CAMPOS_SERIE + CAMPOS_CARTAO, CAMPOS_LANC + CAMPOS_SERIE, CAMPOS_LANC]) {
    const r = await montar(supabase, campos);
    if (r.error?.code === "42703") continue;
    return ((r.data ?? []) as Lancamento[]).map(normLanc);
  }
  return [];
}

/** Lançamentos com competência no mês ou pagos no mês. */
export async function lancamentosDoMes(mes: string): Promise<Lancamento[]> {
  if (!isSupabaseConfigured) return DEMO.lancamentos;
  const { inicio, fim } = limitesMes(mes);
  return consultarLancamentos((supabase, campos) =>
    supabase
      .from("lancamentos")
      .select(campos)
      .or(`and(data.gte.${inicio},data.lte.${fim}),and(pago_em.gte.${inicio},pago_em.lte.${fim})`)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(2000),
  );
}

/** Contas a pagar (saídas ainda não pagas), da mais antiga para a mais nova. */
/** Contas a pagar (saídas não pagas). Compras no cartão ficam de fora: entram pela fatura do cartão. */
export async function contasAPagar(): Promise<Lancamento[]> {
  if (!isSupabaseConfigured) return DEMO.lancamentos.filter((l) => !l.pago && l.tipo === "saida" && !l.cartao_id);
  const lista = await consultarLancamentos((supabase, campos) => supabase.from("lancamentos").select(campos).eq("pago", false).eq("tipo", "saida").order("vencimento").limit(1000));
  return lista.filter((l) => !l.cartao_id);
}

// ---------------------------------------------------------------------------
// Cartões de crédito
// ---------------------------------------------------------------------------
export type FaturaCartao = { cartao: Cartao; fatura_mes: string; vencimento: string; total: number; em_aberto: number; qtd: number };

/** Cartões com o valor em aberto (compras ainda não pagas). Lista vazia se o banco não tem o 0015. */
export const listarCartoes = cache(async function listarCartoes(): Promise<Cartao[]> {
  if (!isSupabaseConfigured) return DEMO.cartoes;
  const supabase = await createClient();
  const [{ data, error }, { data: abertos }] = await Promise.all([
    supabase.from("cartoes").select("id, nome, final, limite, dia_fechamento, dia_vencimento, conta_pagamento_id, ativo").order("criado_em"),
    supabase.from("lancamentos").select("cartao_id, valor").eq("pago", false).not("cartao_id", "is", null).limit(5000),
  ]);
  if (error) return [];
  const soma = new Map<string, number>();
  for (const l of (abertos ?? []) as { cartao_id: string; valor: number }[]) soma.set(l.cartao_id, (soma.get(l.cartao_id) ?? 0) + n(l.valor));
  return ((data ?? []) as Cartao[]).map((c) => ({ ...c, limite: c.limite == null ? null : n(c.limite), em_aberto: arred(soma.get(c.id) ?? 0) }));
});

/** Todas as compras de um cartão (para montar as faturas). */
export async function lancamentosCartao(cartaoId: string): Promise<Lancamento[]> {
  if (!isSupabaseConfigured) return DEMO.lancamentos.filter((l) => l.cartao_id === cartaoId);
  if (!ehUuid(cartaoId)) return [];
  return consultarLancamentos((supabase, campos) =>
    supabase.from("lancamentos").select(campos).eq("cartao_id", cartaoId).order("data", { ascending: false }).limit(2000),
  );
}

/** Faturas de cartão com valor em aberto (todas as compras não pagas, agrupadas por cartão e mês). */
export const faturasCartaoEmAberto = cache(async function faturasCartaoEmAberto(): Promise<FaturaCartao[]> {
  const cartoes = await listarCartoes();
  if (cartoes.length === 0) return [];
  const compras = isSupabaseConfigured
    ? await consultarLancamentos((supabase, campos) => supabase.from("lancamentos").select(campos).eq("pago", false).not("cartao_id", "is", null).limit(5000))
    : DEMO.lancamentos.filter((l) => l.cartao_id && !l.pago);
  const grupos = new Map<string, FaturaCartao>();
  for (const l of compras) {
    const cartao = cartoes.find((c) => c.id === l.cartao_id);
    if (!cartao || !l.fatura_mes) continue;
    const chave = `${cartao.id}:${l.fatura_mes}`;
    const g = grupos.get(chave) ?? { cartao, fatura_mes: l.fatura_mes, vencimento: datasDaFatura(l.fatura_mes, cartao).vencimento, total: 0, em_aberto: 0, qtd: 0 };
    g.total = arred(g.total + l.valor);
    g.em_aberto = arred(g.em_aberto + l.valor);
    g.qtd++;
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
});

export async function contasAReceberAvulsas(): Promise<Lancamento[]> {
  if (!isSupabaseConfigured) return [];
  return consultarLancamentos((supabase, campos) => supabase.from("lancamentos").select(campos).eq("pago", false).eq("tipo", "entrada").order("vencimento").limit(500));
}

// ---------------------------------------------------------------------------
// Faturas
// ---------------------------------------------------------------------------
const CAMPOS_FATURA = "id, numero, cliente_id, periodo_inicio, periodo_fim, emissao, vencimento, total, valor_pago, situacao, observacoes, cliente:clientes (id, nome, telefone)";
const normFatura = (f: Fatura): Fatura => ({ ...f, numero: n(f.numero), total: n(f.total), valor_pago: n(f.valor_pago) });

export const listarFaturas = cache(async function listarFaturas(clienteId?: string): Promise<Fatura[]> {
  if (!isSupabaseConfigured) return DEMO.faturas;
  const supabase = await createClient();
  let q = supabase.from("faturas").select(CAMPOS_FATURA).order("emissao", { ascending: false }).order("numero", { ascending: false }).limit(300);
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const { data } = await q;
  return ((data ?? []) as unknown as Fatura[]).map(normFatura);
});

export async function obterFatura(id: string): Promise<{ fatura: Fatura; itens: ItemFatura[]; pagamentos: PagamentoFatura[] } | null> {
  if (!isSupabaseConfigured) {
    const fatura = DEMO.faturas.find((f) => f.id === id);
    return fatura ? { fatura, itens: DEMO.itensFatura, pagamentos: [] } : null;
  }
  if (!ehUuid(id)) return null;
  const supabase = await createClient();
  const [{ data: f }, { data: itens }, pagamentosRes] = await Promise.all([
    supabase.from("faturas").select(CAMPOS_FATURA).eq("id", id).maybeSingle(),
    supabase.from("fatura_itens").select("id, os_id, data, placa, veiculo, servicos, valor").eq("fatura_id", id).order("data"),
    supabase.from("fatura_pagamentos").select("id, data, valor, forma, conta_id, parcelas, taxa_valor").eq("fatura_id", id).order("data"),
  ]);
  let pagamentos: unknown[] | null = pagamentosRes.data;
  if (pagamentosRes.error?.code === "42703")
    ({ data: pagamentos } = await supabase.from("fatura_pagamentos").select("id, data, valor, forma, conta_id").eq("fatura_id", id).order("data"));
  if (!f) return null;
  return {
    fatura: normFatura(f as unknown as Fatura),
    itens: ((itens ?? []) as ItemFatura[]).map((i) => ({ ...i, valor: n(i.valor) })),
    pagamentos: ((pagamentos ?? []) as PagamentoFatura[]).map((p) => ({ ...p, valor: n(p.valor), taxa_valor: n(p.taxa_valor) })),
  };
}

/** OS de lojistas prontas/entregues que ainda não entraram em fatura. */
export const osParaFaturar = cache(async function osParaFaturar(): Promise<OrdemServico[]> {
  if (!isSupabaseConfigured) return DEMO.os.filter((o) => o.cliente?.lojista && !o.fatura_id && concluida(o.status) && !o.pago);
  const supabase = await createClient();
  const { data } = await supabase
    .from("ordens_servico")
    .select(await camposOS())
    .is("fatura_id", null)
    .eq("pago", false)
    .in("status", ["pronta", "entregue"])
    .order("data");
  return ((data ?? []) as unknown as OrdemServico[]).map(normalizarOS).filter((o) => o.cliente?.lojista);
});

// ---------------------------------------------------------------------------
// Painel e resultado (DRE)
// ---------------------------------------------------------------------------
export type ResumoGestao = {
  faturadoMes: number;
  recebidoMes: number;
  aReceber: { avulsos: number; lojistasSemFatura: number; faturasAbertas: number; total: number };
  saldoContas: number;
  patio: OrdemServico[];
  vagas: number;
  faturasAbertas: Fatura[];
  aPagar7dias: Lancamento[];
  /** Faturas de cartão em aberto vencendo em até 7 dias (ou já vencidas) */
  cartoes7dias: FaturaCartao[];
  estoqueCritico: Produto[];
  porDia: { dia: string; valor: number }[];
  /** Recebido no mês por forma (OS) e por faturas de lojistas */
  porForma: { chave: string; valor: number }[];
  entradasHoje: number;
  saidasHoje: number;
  entreguesHoje: number;
  qtdOSMes: number;
};

export async function resumoGestao(mes: string): Promise<ResumoGestao> {
  const hoje = hojeISO();
  const [config, osMes, patio, receber, faturas, contas, lancMes, aPagar, produtos, categorias] = await Promise.all([
    obterConfig(),
    listarOS({ filtro: "todas", mes }),
    listarOS({ filtro: "patio", mes }),
    listarOS({ filtro: "receber", mes }),
    listarFaturas(),
    listarContas(),
    lancamentosDoMes(mes),
    contasAPagar(),
    listarProdutos(),
    listarCategorias(),
  ]);
  const faturasCartao = await faturasCartaoEmAberto();
  const fora = new Set(categorias.filter((c) => c.dre === "fora").map((c) => c.id));

  const concluidasMes = osMes.filter((o) => concluida(o.status));
  const faturadoMes = arred(concluidasMes.reduce((t, o) => t + o.total, 0));
  const recebidoMes = arred(
    lancMes
      .filter((l) => l.tipo === "entrada" && l.pago && (l.pago_em ?? l.data).startsWith(mes) && !(l.categoria_id && fora.has(l.categoria_id)))
      .reduce((t, l) => t + l.valor, 0),
  );
  const avulsos = arred(receber.filter((o) => !o.cliente?.lojista).reduce((t, o) => t + faltaReceber(o), 0));
  const lojistasSemFatura = arred(receber.filter((o) => o.cliente?.lojista && !o.fatura_id).reduce((t, o) => t + o.total, 0));
  const abertas = faturas.filter(faturaEmAberto);
  const faturasAbertas = arred(abertas.reduce((t, f) => t + f.total - f.valor_pago, 0));

  const dias = new Map<string, number>();
  for (const o of concluidasMes) dias.set(o.data, (dias.get(o.data) ?? 0) + o.total);
  const { inicio, fim } = limitesMes(mes);
  const porDia: { dia: string; valor: number }[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) porDia.push({ dia: d, valor: arred(dias.get(d) ?? 0) });

  const formas = new Map<string, number>();
  for (const o of osMes) if (o.pago && o.forma_pagamento && (o.pago_em ?? "").startsWith(mes) && !o.fatura_id) formas.set(o.forma_pagamento, (formas.get(o.forma_pagamento) ?? 0) + o.total);
  const recebidoFaturas = lancMes.filter((l) => l.tipo === "entrada" && l.pago && l.fatura_id && (l.pago_em ?? l.data).startsWith(mes)).reduce((t, l) => t + l.valor, 0);
  const porForma = (["pix", "debito", "credito", "dinheiro", "transferencia"] as const).map((chave) => ({ chave: chave as string, valor: arred(formas.get(chave) ?? 0) }));
  porForma.push({ chave: "faturas", valor: arred(recebidoFaturas) });
  const hojePagos = lancMes.filter((l) => l.pago && (l.pago_em ?? l.data) === hoje);

  return {
    porForma,
    entradasHoje: arred(hojePagos.filter((l) => l.tipo === "entrada").reduce((t, l) => t + l.valor, 0)),
    saidasHoje: arred(hojePagos.filter((l) => l.tipo === "saida").reduce((t, l) => t + l.valor, 0)),
    entreguesHoje: osMes.filter((o) => o.status === "entregue" && o.entregue_em && hojeISO(new Date(o.entregue_em)) === hoje).length,
    qtdOSMes: osMes.filter((o) => o.status !== "cancelada").length,
    faturadoMes,
    recebidoMes,
    aReceber: { avulsos, lojistasSemFatura, faturasAbertas, total: arred(avulsos + lojistasSemFatura + faturasAbertas) },
    saldoContas: arred(contas.filter((c) => c.ativa).reduce((t, c) => t + c.saldo, 0)),
    patio: [...patio].sort((a, b) => a.numero - b.numero),
    vagas: config.vagas_patio,
    faturasAbertas: abertas.sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    aPagar7dias: aPagar.filter((l) => (l.vencimento ?? l.data) <= somarDias(hoje, 7)),
    cartoes7dias: faturasCartao.filter((f) => f.vencimento <= somarDias(hoje, 7)),
    estoqueCritico: produtos.filter((p) => p.ativo && p.saldo <= p.minimo),
    porDia,
  };
}

export type DRE = {
  receita: number;
  qtdOS: number;
  taxas: number;
  produtos: number;
  margemBruta: number;
  despesas: { categoria: string; valor: number }[];
  totalDespesas: number;
  outrasReceitas: number;
  resultado: number;
  comprasProdutos: number;
};

/** Resultado do mês por competência: o que foi feito no mês, não o que caiu no caixa. */
export async function dreDoMes(mes: string): Promise<DRE> {
  const [osMes, lancMes, categorias] = await Promise.all([listarOS({ filtro: "todas", mes }), lancamentosDoMes(mes), listarCategorias()]);
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const doMes = lancMes.filter((l) => l.data.startsWith(mes));
  const concl = osMes.filter((o) => concluida(o.status));
  const receita = arred(concl.reduce((t, o) => t + o.total, 0));
  const produtos = arred(concl.reduce((t, o) => t + o.custo_produtos, 0));
  const soma = (f: (l: Lancamento) => boolean) => arred(doMes.filter(f).reduce((t, l) => t + l.valor, 0));
  const taxas = soma((l) => l.tipo === "saida" && cat.get(l.categoria_id ?? "")?.dre === "taxa");
  // Receitas lançadas à mão (não vindas de OS/fatura, que já estão na receita das OS)
  const outrasReceitas = soma(
    (l) => l.tipo === "entrada" && !l.os_id && !l.fatura_id && cat.get(l.categoria_id ?? "")?.dre === "receita" && !cat.get(l.categoria_id ?? "")?.sistema,
  );
  const comprasProdutos = soma((l) => l.tipo === "saida" && cat.get(l.categoria_id ?? "")?.dre === "estoque");
  const porCategoria = new Map<string, number>();
  for (const l of doMes) {
    const c = cat.get(l.categoria_id ?? "");
    if (l.tipo !== "saida" || (c && c.dre !== "despesa")) continue;
    const nome = c?.nome ?? "Sem categoria";
    porCategoria.set(nome, arred((porCategoria.get(nome) ?? 0) + l.valor));
  }
  const despesas = [...porCategoria].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  const totalDespesas = arred(despesas.reduce((t, d) => t + d.valor, 0));
  const margemBruta = arred(receita - taxas - produtos);
  return {
    receita,
    qtdOS: concl.length,
    taxas,
    produtos,
    margemBruta,
    despesas,
    totalDespesas,
    outrasReceitas,
    resultado: arred(margemBruta + outrasReceitas - totalDespesas),
    comprasProdutos,
  };
}

// ---------------------------------------------------------------------------
// Dados de demonstração (só enquanto o banco não está conectado)
// ---------------------------------------------------------------------------
const hoje = hojeISO();
const fichaDemo: Ficha = { id: "demo-ficha", perfil_id: "demo", nome: "Cliente Demonstração", telefone: "(17) 99999-0000", email: "demo@semprezero.app", lojista: false, observacoes: null, criado_em: `${hoje}T12:00:00Z` };
const lojistaDemo: Ficha = { id: "demo-lojista", perfil_id: null, nome: "Auto Center Revenda (lojista)", telefone: "(17) 98888-0000", email: null, lojista: true, observacoes: "Fatura todo dia 5.", criado_em: `${hoje}T12:00:00Z` };
const produtosDemo: Produto[] = [
  { id: "demo-p1", nome: "Shampoo automotivo", unidade: "ml", saldo: 4200, minimo: 1000, custo_medio: 0.04, ativo: true },
  { id: "demo-p2", nome: "Cera de carnaúba", unidade: "g", saldo: 150, minimo: 200, custo_medio: 0.35, ativo: true },
  { id: "demo-p3", nome: "Pano de microfibra", unidade: "un", saldo: 0, minimo: 5, custo_medio: 6.5, ativo: true },
];
const catalogoDemo: ServicoCatalogo[] = [
  { id: "demo-c1", nome: "Lavagem completa", preco: 80, categoria: "estetica", ativo: true, consumo: [{ produto_id: "demo-p1", quantidade: 80, produto: produtosDemo[0] }] },
  { id: "demo-c2", nome: "Enceramento", preco: 120, categoria: "estetica", ativo: true, consumo: [{ produto_id: "demo-p2", quantidade: 40, produto: produtosDemo[1] }] },
  { id: "demo-c3", nome: "Polimento técnico", preco: 650, categoria: "estetica", ativo: true, consumo: [] },
  { id: "demo-c4", nome: "Higienização interna", preco: 350, categoria: "estetica", ativo: true, consumo: [] },
];
const osBase = {
  km: null, observacoes: null, pago_em: null, forma_pagamento: null, conta_id: null, taxa_valor: 0, fatura_id: null,
  estoque_baixado: false, agendamento_id: null, orcamento_id: null, pronta_em: null, entregue_em: null, criado_em: `${hoje}T12:00:00Z`,
} as const;
const osDemo: OrdemServico[] = [
  {
    ...osBase, id: "demo-os1", numero: 3, cliente_id: fichaDemo.id, veiculo_id: "demo-civic", placa: "BRA2E19", veiculo_nome: "Honda Civic EXL", data: hoje,
    status: "em_andamento", subtotal: 200, desconto: 0, total: 200, pago: false, custo_produtos: 0,
    itens: [{ catalogo_id: "demo-c1", nome: "Lavagem completa", preco: 80 }, { catalogo_id: "demo-c2", nome: "Enceramento", preco: 120 }],
    cliente: { id: fichaDemo.id, nome: fichaDemo.nome, telefone: fichaDemo.telefone, lojista: false, perfil_id: "demo" },
  },
  {
    ...osBase, id: "demo-os2", numero: 2, cliente_id: lojistaDemo.id, veiculo_id: null, placa: "FKT3B21", veiculo_nome: "Toyota Corolla XEi", data: somarDias(hoje, -1),
    status: "pronta", subtotal: 80, desconto: 0, total: 80, pago: false, custo_produtos: 3.2, estoque_baixado: true,
    itens: [{ catalogo_id: "demo-c1", nome: "Lavagem completa", preco: 80 }],
    cliente: { id: lojistaDemo.id, nome: lojistaDemo.nome, telefone: lojistaDemo.telefone, lojista: true, perfil_id: null },
  },
  {
    ...osBase, id: "demo-os3", numero: 1, cliente_id: fichaDemo.id, veiculo_id: "demo-civic", placa: "BRA2E19", veiculo_nome: "Honda Civic EXL", data: somarDias(hoje, -2),
    status: "entregue", subtotal: 650, desconto: 50, total: 600, pago: true, pago_em: somarDias(hoje, -2), forma_pagamento: "pix", custo_produtos: 0,
    itens: [{ catalogo_id: "demo-c3", nome: "Polimento técnico", preco: 650 }],
    cliente: { id: fichaDemo.id, nome: fichaDemo.nome, telefone: fichaDemo.telefone, lojista: false, perfil_id: "demo" },
  },
];
const DEMO = {
  fichas: [
    { ...fichaDemo, veiculos: [{ id: "demo-civic", placa: "BRA2E19", marca: "Honda", modelo: "Civic EXL", apelido: null, ano: 2021, dono_id: "demo" }], total_gasto: 600, ultima_visita: hoje, qtd_os: 2 },
    { ...lojistaDemo, veiculos: [], total_gasto: 80, ultima_visita: somarDias(hoje, -1), qtd_os: 1 },
  ] satisfies FichaComResumo[],
  produtos: produtosDemo,
  catalogo: catalogoDemo,
  os: osDemo,
  contas: [
    { id: "demo-k1", nome: "Caixa da loja", tipo: "caixa", saldo_inicial: 0, ativa: true, saldo: 350, formas: ["dinheiro"], taxa_pix: 0, taxa_debito: 0, taxa_credito: 0, taxas_parcelado: {} },
    { id: "demo-k2", nome: "Banco", tipo: "banco", saldo_inicial: 1000, ativa: true, saldo: 1600, formas: ["pix", "transferencia"], taxa_pix: 0, taxa_debito: 0, taxa_credito: 0, taxas_parcelado: {} },
    { id: "demo-k3", nome: "Maquininha", tipo: "outro", saldo_inicial: 0, ativa: true, saldo: 0, formas: ["debito", "credito", "pix"], taxa_pix: 0.99, taxa_debito: 1.99, taxa_credito: 3.49, taxas_parcelado: { "2": 5.39, "3": 6.19, "6": 8.49 } },
  ] as Conta[],
  cartoes: [
    { id: "demo-cc1", nome: "Cartão empresa", final: "4321", limite: 8000, dia_fechamento: 5, dia_vencimento: 12, conta_pagamento_id: "demo-k2", ativo: true, em_aberto: 1250 },
  ] as Cartao[],
  categorias: [
    { id: "demo-cat1", nome: "Serviços (OS)", tipo: "entrada", dre: "receita", sistema: "os", ativa: true },
    { id: "demo-cat2", nome: "Faturas de lojistas", tipo: "entrada", dre: "receita", sistema: "fatura", ativa: true },
    { id: "demo-cat3", nome: "Taxas de cartão", tipo: "saida", dre: "taxa", sistema: "taxa", ativa: true },
    { id: "demo-cat4", nome: "Compra de produtos", tipo: "saida", dre: "estoque", sistema: "compra_produtos", ativa: true },
    { id: "demo-cat5", nome: "Aluguel", tipo: "saida", dre: "despesa", sistema: null, ativa: true },
  ] satisfies CategoriaFinanceira[],
  lancamentos: [
    { id: "demo-l1", data: somarDias(hoje, -2), vencimento: null, tipo: "entrada", descricao: "OS #1 · BRA2E19", valor: 600, categoria_id: "demo-cat1", conta_id: "demo-k2", pago: true, pago_em: somarDias(hoje, -2), os_id: "demo-os3", fatura_id: null },
    { id: "demo-l3", data: hoje, vencimento: faturaDaCompra(hoje, { dia_fechamento: 5, dia_vencimento: 12 }).vencimento, tipo: "saida", descricao: "Produtos de limpeza (atacado)", valor: 850, categoria_id: "demo-cat4", conta_id: null, pago: false, pago_em: null, os_id: null, fatura_id: null, cartao_id: "demo-cc1", fatura_mes: faturaDaCompra(hoje, { dia_fechamento: 5, dia_vencimento: 12 }).fatura_mes },
    { id: "demo-l4", data: hoje, vencimento: faturaDaCompra(hoje, { dia_fechamento: 5, dia_vencimento: 12 }).vencimento, tipo: "saida", descricao: "Combustível", valor: 400, categoria_id: "demo-cat5", conta_id: null, pago: false, pago_em: null, os_id: null, fatura_id: null, cartao_id: "demo-cc1", fatura_mes: faturaDaCompra(hoje, { dia_fechamento: 5, dia_vencimento: 12 }).fatura_mes },
    { id: "demo-l2", data: hoje, vencimento: somarDias(hoje, 5), tipo: "saida", descricao: "Aluguel do galpão", valor: 1800, categoria_id: "demo-cat5", conta_id: "demo-k2", pago: false, pago_em: null, os_id: null, fatura_id: null, grupo_id: "demo-g1", parcela: 1, total_parcelas: 12, recorrente: true },
  ] satisfies Lancamento[],
  faturas: [
    { id: "demo-f1", numero: 1, cliente_id: lojistaDemo.id, periodo_inicio: somarDias(hoje, -40), periodo_fim: somarDias(hoje, -10), emissao: somarDias(hoje, -9), vencimento: somarDias(hoje, -2), total: 480, valor_pago: 200, situacao: "parcial", observacoes: null, cliente: { id: lojistaDemo.id, nome: lojistaDemo.nome, telefone: lojistaDemo.telefone } },
  ] satisfies Fatura[],
  itensFatura: [
    { id: "demo-fi1", os_id: null, data: somarDias(hoje, -30), placa: "QWE1R23", veiculo: "VW Polo", servicos: "Lavagem completa, Enceramento", valor: 200 },
    { id: "demo-fi2", os_id: null, data: somarDias(hoje, -12), placa: "FKT3B21", veiculo: "Toyota Corolla XEi", servicos: "Polimento técnico", valor: 280 },
  ] satisfies ItemFatura[],
};
