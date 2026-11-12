// Gestão da loja: tipos, listas e regras (sem acesso a banco: pode ser usado no cliente e no servidor)
import { hojeISO, somarDias, type Categoria } from "@/lib/garagem";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type Ficha = {
  id: string;
  perfil_id: string | null; // conta no app (vazio = sem login)
  nome: string;
  telefone: string | null;
  email: string | null;
  lojista: boolean;
  observacoes: string | null;
  criado_em: string;
};

export type VeiculoResumo = { id: string; placa: string; marca: string; modelo: string; apelido: string | null; ano: number | null; dono_id: string | null };

export type FichaComResumo = Ficha & {
  veiculos: VeiculoResumo[];
  total_gasto: number;
  ultima_visita: string | null;
  qtd_os: number;
};

export type Unidade = "un" | "ml" | "l" | "g" | "kg";
export const UNIDADES: Record<Unidade, string> = { un: "unidade", ml: "ml", l: "litro", g: "grama", kg: "kg" };

export type Produto = {
  id: string;
  nome: string;
  unidade: Unidade;
  saldo: number;
  minimo: number;
  custo_medio: number;
  ativo: boolean;
};

export type MovimentoEstoque = {
  id: string;
  produto_id: string;
  criado_em: string;
  tipo: "baixa" | "reposicao" | "ajuste";
  quantidade: number;
  custo_unitario: number;
  saldo_apos: number;
  origem: string | null;
  os_id: string | null;
  observacao: string | null;
};

export type Consumo = { produto_id: string; quantidade: number; produto?: Pick<Produto, "nome" | "unidade" | "custo_medio"> | null };

export type ServicoCatalogo = {
  id: string;
  nome: string;
  preco: number;
  categoria: Categoria;
  ativo: boolean;
  consumo: Consumo[];
};

export const STATUS_OS = {
  aberta: { rotulo: "Aberta", classe: "bg-marca-clara text-marca-escura", proximo: "em_andamento", acao: "Iniciar serviço" },
  em_andamento: { rotulo: "Em andamento", classe: "bg-alerta-claro text-[#8a5a00]", proximo: "pronta", acao: "Marcar como pronta" },
  pronta: { rotulo: "Pronta", classe: "bg-sucesso-claro text-sucesso", proximo: "entregue", acao: "Entregar ao cliente" },
  entregue: { rotulo: "Entregue", classe: "bg-fundo text-suave", proximo: null, acao: null },
  cancelada: { rotulo: "Cancelada", classe: "bg-perigo-claro text-perigo", proximo: null, acao: null },
} as const;
export type StatusOS = keyof typeof STATUS_OS;
/** OS que ainda ocupa vaga no pátio */
export const noPatio = (s: StatusOS) => s === "aberta" || s === "em_andamento" || s === "pronta";
/** Serviço concluído: conta como faturado (competência) */
export const concluida = (s: StatusOS) => s === "pronta" || s === "entregue";

export const FORMAS_PAGAMENTO = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  transferencia: "Transferência",
} as const;
export type FormaPagamento = keyof typeof FORMAS_PAGAMENTO;
export const rotuloForma = (f: FormaPagamento, parcelas?: number | null) =>
  `${FORMAS_PAGAMENTO[f]}${f === "credito" && parcelas && parcelas > 1 ? ` em ${parcelas}x` : ""}`;
export const ehFormaPagamento = (f: string): f is FormaPagamento => f in FORMAS_PAGAMENTO;

export type ItemOS = { id?: string; catalogo_id: string | null; nome: string; preco: number; ordem?: number };

export type OrdemServico = {
  id: string;
  numero: number;
  cliente_id: string;
  veiculo_id: string | null;
  placa: string | null;
  veiculo_nome: string | null;
  data: string;
  status: StatusOS;
  km: number | null;
  observacoes: string | null;
  subtotal: number;
  desconto: number;
  total: number;
  pago: boolean;
  pago_em: string | null;
  forma_pagamento: FormaPagamento | null;
  parcelas?: number | null;
  /** Quanto já foi pago (pagamentos divididos, 0013) */
  valor_pago?: number;
  conta_id: string | null;
  taxa_valor: number;
  fatura_id: string | null;
  custo_produtos: number;
  estoque_baixado: boolean;
  agendamento_id: string | null;
  orcamento_id: string | null;
  pronta_em: string | null;
  entregue_em: string | null;
  criado_em: string;
  itens: ItemOS[];
  cliente: Pick<Ficha, "id" | "nome" | "telefone" | "lojista" | "perfil_id"> | null;
};

export type Conta = {
  id: string;
  nome: string;
  tipo: "banco" | "caixa" | "digital" | "outro";
  saldo_inicial: number;
  ativa: boolean;
  saldo: number;
  /** Formas de recebimento que esta conta aceita */
  formas: FormaPagamento[];
  taxa_pix: number;
  taxa_debito: number;
  /** Crédito à vista (1x) */
  taxa_credito: number;
  /** Crédito parcelado: { "2": 4.59, "3": 5.29 } — parcelas sem taxa não são aceitas */
  taxas_parcelado: Record<string, number>;
};
/** Até quantas parcelas o crédito pode ser configurado */
export const MAX_PARCELAS = 12;

/** Parcelas aceitas no crédito pela conta: 1x (à vista) e as que têm taxa preenchida. */
export function parcelasAceitas(c: Pick<Conta, "taxas_parcelado">) {
  return [1, ...Object.keys(c.taxas_parcelado ?? {}).map(Number).filter((n) => n >= 2 && n <= MAX_PARCELAS).sort((a, b) => a - b)];
}

/** Percentual de taxa da conta para a forma (e parcelas, no crédito). */
export function taxaPercentual(c: Pick<Conta, "taxa_pix" | "taxa_debito" | "taxa_credito" | "taxas_parcelado">, forma: FormaPagamento, parcelas = 1) {
  if (forma === "pix") return c.taxa_pix;
  if (forma === "debito") return c.taxa_debito;
  if (forma === "credito") return parcelas > 1 ? (c.taxas_parcelado[String(parcelas)] ?? 0) : c.taxa_credito;
  return 0;
}

export const TIPOS_CONTA = { banco: "Banco", caixa: "Caixa", digital: "Conta digital", outro: "Outra" } as const;

export type CategoriaFinanceira = {
  id: string;
  nome: string;
  tipo: "entrada" | "saida";
  dre: "receita" | "taxa" | "estoque" | "despesa" | "fora";
  sistema: string | null;
  ativa: boolean;
};

export type Lancamento = {
  id: string;
  data: string;
  vencimento: string | null;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  categoria_id: string | null;
  conta_id: string | null;
  pago: boolean;
  pago_em: string | null;
  os_id: string | null;
  fatura_id: string | null;
  /** Série: lançamentos recorrentes ou parcelados (mesmo grupo_id) */
  grupo_id?: string | null;
  parcela?: number | null;
  total_parcelas?: number | null;
  recorrente?: boolean;
};

/** "Recorrente" ou "Parcela 2/3" */
export function rotuloSerie(l: Pick<Lancamento, "grupo_id" | "parcela" | "total_parcelas" | "recorrente">) {
  if (!l.grupo_id) return null;
  return l.recorrente ? `Recorrente · ${l.parcela}/${l.total_parcelas}` : `Parcela ${l.parcela}/${l.total_parcelas}`;
}

export type SituacaoFatura = "aberta" | "parcial" | "paga" | "cancelada";
export type Fatura = {
  id: string;
  numero: number;
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  emissao: string;
  vencimento: string;
  total: number;
  valor_pago: number;
  situacao: SituacaoFatura;
  observacoes: string | null;
  cliente: Pick<Ficha, "id" | "nome" | "telefone"> | null;
};
/** Um pagamento recebido numa OS (ela pode ter vários). */
export type PagamentoOS = { id: string; data: string; valor: number; forma: FormaPagamento; conta_id: string | null; parcelas: number | null; taxa_valor: number };

/** Quanto ainda falta receber da OS. */
export const faltaReceber = (o: Pick<OrdemServico, "total" | "valor_pago" | "pago">) => (o.pago ? 0 : arred(o.total - (o.valor_pago ?? 0)));

export type ItemFatura = { id: string; os_id: string | null; data: string; placa: string | null; veiculo: string | null; servicos: string; valor: number };
export type PagamentoFatura = { id: string; data: string; valor: number; forma: FormaPagamento | null; conta_id: string | null; parcelas?: number | null; taxa_valor?: number | null };

export type ConfigGestao = { vagas_patio: number; taxa_debito: number; taxa_credito: number };
export const CONFIG_PADRAO: ConfigGestao = { vagas_patio: 6, taxa_debito: 1.99, taxa_credito: 3.49 };

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

/** Para buscas: minúsculas e sem acento ("Polimento Técnico" → "polimento tecnico"). */
export function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Todas as palavras da busca aparecem no texto (em qualquer ordem). */
export function combina(texto: string, busca: string) {
  const t = semAcento(texto);
  return semAcento(busca)
    .split(/\s+/)
    .filter(Boolean)
    .every((p) => t.includes(p));
}

export const arred = (v: number) => Math.round(v * 100) / 100;

/** Custo dos produtos gastos em um serviço do catálogo. */
export const custoServico = (s: Pick<ServicoCatalogo, "consumo">) =>
  arred(s.consumo.reduce((t, c) => t + c.quantidade * (c.produto?.custo_medio ?? 0), 0));

export function situacaoProduto(p: Pick<Produto, "saldo" | "minimo">) {
  if (p.saldo <= 0) return { chave: "sem" as const, rotulo: "Sem estoque", classe: "bg-perigo-claro text-perigo" };
  if (p.saldo <= p.minimo) return { chave: "critico" as const, rotulo: "Crítico", classe: "bg-alerta-claro text-[#8a5a00]" };
  return { chave: "ok" as const, rotulo: "Saudável", classe: "bg-sucesso-claro text-sucesso" };
}

export function formatarQtd(q: number, unidade: Unidade) {
  return `${q.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unidade}`;
}

/** Situação para exibir (inclui "vencida", que depende da data de hoje). */
export function situacaoFatura(f: Pick<Fatura, "situacao" | "vencimento">, hoje = hojeISO()) {
  if ((f.situacao === "aberta" || f.situacao === "parcial") && f.vencimento < hoje)
    return { rotulo: "Vencida", classe: "bg-perigo-claro text-perigo" };
  return {
    aberta: { rotulo: "Em aberto", classe: "bg-marca-clara text-marca-escura" },
    parcial: { rotulo: "Parcial", classe: "bg-alerta-claro text-[#8a5a00]" },
    paga: { rotulo: "Paga", classe: "bg-sucesso-claro text-sucesso" },
    cancelada: { rotulo: "Cancelada", classe: "bg-fundo text-suave" },
  }[f.situacao];
}
export const faturaEmAberto = (f: Pick<Fatura, "situacao">) => f.situacao === "aberta" || f.situacao === "parcial";

// ---------------------------------------------------------------------------
// Meses (AAAA-MM)
// ---------------------------------------------------------------------------
export const mesAtual = (hoje = hojeISO()) => hoje.slice(0, 7);
export const mesValido = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function limitesMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { inicio: `${mes}-01`, fim };
}
export function somarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export function nomeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

/** "Hoje", "Ontem" ou "Dia 4, quarta-feira" */
export function rotuloDia(dia: string, hoje = hojeISO()) {
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, -1)) return "Ontem";
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`));
  return `Dia ${Number(dia.slice(8, 10))}, ${semana}`;
}

/** Agrupa por mês e, dentro dele, por dia (do mais recente para o mais antigo). */
export function agruparPorMesEDia<T>(lista: T[], dataDe: (x: T) => string) {
  const ordenada = [...lista].sort((a, b) => dataDe(b).localeCompare(dataDe(a)));
  const meses: { mes: string; dias: { dia: string; itens: T[] }[] }[] = [];
  for (const x of ordenada) {
    const dia = dataDe(x).slice(0, 10);
    const mes = dia.slice(0, 7);
    let m = meses.at(-1);
    if (!m || m.mes !== mes) meses.push((m = { mes, dias: [] }));
    let d = m.dias.at(-1);
    if (!d || d.dia !== dia) m.dias.push((d = { dia, itens: [] }));
    d.itens.push(x);
  }
  return meses;
}

/** "Novembro" (ou "Novembro de 2025" se for de outro ano) */
export function tituloMes(mes: string, hoje = hojeISO()) {
  const n = nomeMes(mes);
  return mes.slice(0, 4) === hoje.slice(0, 4) ? n.split(" de ")[0] : n;
}

export const emSeteDias = (hoje = hojeISO()) => somarDias(hoje, 7);

// ---------------------------------------------------------------------------
// Dinheiro digitado ("1.234,56" ou "1234.56")
// ---------------------------------------------------------------------------
export function lerDinheiro(s: string | null | undefined): number | null {
  const t = String(s ?? "").replace(/[^\d,.-]/g, "");
  if (!t) return null;
  const v = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(v) ? arred(v) : null;
}
export function lerNumero(s: string | null | undefined): number | null {
  const t = String(s ?? "").replace(/[^\d,.-]/g, "");
  if (!t) return null;
  const v = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(v) ? v : null;
}
export const valorCampo = (v: number | null | undefined) =>
  v == null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------
export function linkWhatsApp(telefone: string | null | undefined, texto: string) {
  const n = (telefone ?? "").replace(/\D/g, "");
  const base = n ? `https://wa.me/${n.length <= 11 ? `55${n}` : n}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(texto)}`;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

export function resumoOSWhatsApp(os: OrdemServico, empresa = "Nexus Automotive") {
  const linhas = [
    `*${empresa}* — OS #${os.numero}`,
    `${os.cliente?.nome ?? ""}`,
    [os.veiculo_nome, os.placa].filter(Boolean).join(" · "),
    `Data: ${dataBr(os.data)} · ${STATUS_OS[os.status].rotulo}`,
    "",
    ...os.itens.map((i) => `• ${i.nome}: ${brl(i.preco)}`),
  ];
  if (os.desconto > 0) linhas.push(`Desconto: −${brl(os.desconto)}`);
  linhas.push(`*Total: ${brl(os.total)}*`);
  if (os.pago) linhas.push(`Pago${os.forma_pagamento ? ` (${rotuloForma(os.forma_pagamento, os.parcelas)})` : ""}. Obrigado!`);
  else if ((os.valor_pago ?? 0) > 0) linhas.push(`Já pago: ${brl(os.valor_pago ?? 0)} · falta ${brl(arred(os.total - (os.valor_pago ?? 0)))}`);
  else if (os.cliente?.lojista) linhas.push("Valor entra na fatura do mês.");
  return linhas.filter((l, i) => l !== "" || i === 4).join("\n");
}

export function extratoFaturaWhatsApp(f: Fatura, itens: ItemFatura[], empresa = "Nexus Automotive") {
  const saldo = arred(f.total - f.valor_pago);
  return [
    `*${empresa}* — Fatura #${f.numero}`,
    f.cliente?.nome ?? "",
    `Período: ${dataBr(f.periodo_inicio)} a ${dataBr(f.periodo_fim)}`,
    "",
    ...itens.map((i) => `${dataBr(i.data)} · ${i.placa ?? ""} ${i.veiculo ?? ""} — ${i.servicos}: ${brl(i.valor)}`),
    "",
    `*Total: ${brl(f.total)}*`,
    ...(f.valor_pago > 0 ? [`Já pago: ${brl(f.valor_pago)}`, `*Saldo: ${brl(saldo)}*`] : []),
    `Vencimento: ${dataBr(f.vencimento)}`,
  ].join("\n");
}
