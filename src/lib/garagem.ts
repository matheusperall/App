// Tipos, listas e regras da garagem (sem acesso a banco: pode ser usado no cliente e no servidor)

export type Veiculo = {
  id: string;
  dono_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number | null;
  cor: string | null;
  apelido: string | null;
  km_atual: number;
  km_atualizado_em: string;
  foto: string | null;
  // Tabela FIPE (opcionais: veículos antigos ou preenchidos à mão não têm)
  tipo?: "carro" | "moto" | "caminhao";
  combustivel?: string | null;
  codigo_fipe?: string | null;
  valor_fipe?: number | null;
  fipe_referencia?: string | null;
  fipe_marca_cod?: string | null;
  fipe_modelo_cod?: string | null;
  fipe_ano_cod?: string | null;
};

export type Servico = {
  id: string;
  veiculo_id: string;
  data: string; // AAAA-MM-DD
  categoria: Categoria;
  titulo: string;
  descricao: string | null;
  km: number | null;
  valor: number | null;
  prestador: "proprio" | "terceirizado" | "externo";
  fotos: string[];
  pela_empresa: boolean;
};

export type Manutencao = {
  id: string;
  veiculo_id: string;
  tipo: string;
  ultima_data: string | null;
  ultimo_km: number | null;
  intervalo_meses: number | null;
  intervalo_km: number | null;
  proxima_data: string | null;
  proximo_km: number | null;
  definido_pela_empresa: boolean;
};

export const CATEGORIAS = {
  estetica: { rotulo: "Estética", icone: "✨" },
  funilaria_pintura: { rotulo: "Funilaria e pintura", icone: "🎨" },
  mecanica: { rotulo: "Mecânica", icone: "🔧" },
  eletrica: { rotulo: "Elétrica", icone: "⚡" },
  acessorios: { rotulo: "Acessórios", icone: "🧩" },
  outros: { rotulo: "Outros", icone: "📋" },
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export const PRESTADORES = {
  proprio: "Sempre Zero",
  terceirizado: "Parceiro (terceirizado)",
  externo: "Registrado pelo cliente",
} as const;

/**
 * Manutenções periódicas com intervalos comuns de mercado.
 * São sugestões: o cliente pode ajustar, e a oficina define a próxima ao registrar o serviço.
 */
export const TIPOS_MANUTENCAO = {
  oleo: { rotulo: "Troca de óleo e filtro", meses: 12, km: 10000, categoria: "mecanica" },
  alinhamento: { rotulo: "Alinhamento e balanceamento", meses: 12, km: 10000, categoria: "mecanica" },
  revisao: { rotulo: "Revisão geral", meses: 12, km: 10000, categoria: "mecanica" },
  rodizio_pneus: { rotulo: "Rodízio de pneus", meses: 12, km: 10000, categoria: "mecanica" },
  freios: { rotulo: "Verificação dos freios", meses: 12, km: 20000, categoria: "mecanica" },
  fluido_freio: { rotulo: "Troca do fluido de freio", meses: 24, km: null, categoria: "mecanica" },
  ar_condicionado: { rotulo: "Higienização do ar-condicionado", meses: 12, km: null, categoria: "mecanica" },
  higienizacao_interna: { rotulo: "Higienização interna", meses: 6, km: null, categoria: "estetica" },
  protecao_pintura: { rotulo: "Manutenção da proteção da pintura", meses: 6, km: null, categoria: "estetica" },
} as const satisfies Record<string, { rotulo: string; meses: number; km: number | null; categoria: Categoria }>;
export type TipoManutencao = keyof typeof TIPOS_MANUTENCAO;

export const ehTipoManutencao = (t: string): t is TipoManutencao => t in TIPOS_MANUTENCAO;
export const rotuloManutencao = (t: string) => (ehTipoManutencao(t) ? TIPOS_MANUTENCAO[t].rotulo : t);

// ---------------------------------------------------------------------------
// Datas (sempre no fuso de Brasília, formato AAAA-MM-DD)
// ---------------------------------------------------------------------------
export function hojeISO(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function somarMeses(dataISO: string, meses: number) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export function diasEntre(deISO: string, ateISO: string) {
  return Math.round((Date.parse(ateISO) - Date.parse(deISO)) / 86_400_000);
}

export function formatarData(dataISO: string | null | undefined) {
  if (!dataISO) return "—";
  const [a, m, d] = dataISO.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export const formatarKm = (km: number | null | undefined) =>
  km == null ? "—" : `${km.toLocaleString("pt-BR")} km`;

export const formatarValor = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Próxima data e km a partir da última execução e do intervalo. */
export function calcularProxima(
  ultimaData: string | null,
  ultimoKm: number | null,
  meses: number | null,
  km: number | null,
) {
  return {
    proxima_data: ultimaData && meses ? somarMeses(ultimaData, meses) : null,
    proximo_km: ultimoKm != null && km ? ultimoKm + km : null,
  };
}

// ---------------------------------------------------------------------------
// Situação de uma manutenção
// ---------------------------------------------------------------------------
export type Situacao = "vencida" | "em_breve" | "em_dia" | "sem_dados";

export const AVISO_DIAS = 30;
export const AVISO_KM = 1000;

export function situacaoManutencao(m: Pick<Manutencao, "proxima_data" | "proximo_km">, kmAtual: number, hoje = hojeISO()) {
  const dias = m.proxima_data ? diasEntre(hoje, m.proxima_data) : null;
  const kmRestante = m.proximo_km != null ? m.proximo_km - kmAtual : null;
  if (dias == null && kmRestante == null) return { situacao: "sem_dados" as Situacao, dias, kmRestante };
  if ((dias != null && dias < 0) || (kmRestante != null && kmRestante <= 0))
    return { situacao: "vencida" as Situacao, dias, kmRestante };
  if ((dias != null && dias <= AVISO_DIAS) || (kmRestante != null && kmRestante <= AVISO_KM))
    return { situacao: "em_breve" as Situacao, dias, kmRestante };
  return { situacao: "em_dia" as Situacao, dias, kmRestante };
}

export function descreverPrazo(dias: number | null, kmRestante: number | null) {
  const partes: string[] = [];
  if (dias != null) {
    if (dias < 0) partes.push(`venceu há ${-dias} ${-dias === 1 ? "dia" : "dias"}`);
    else if (dias === 0) partes.push("vence hoje");
    else partes.push(`em ${dias} ${dias === 1 ? "dia" : "dias"}`);
  }
  if (kmRestante != null) {
    if (kmRestante <= 0) partes.push(`passou ${(-kmRestante).toLocaleString("pt-BR")} km`);
    else partes.push(`faltam ${kmRestante.toLocaleString("pt-BR")} km`);
  }
  return partes.join(" · ");
}

// ---------------------------------------------------------------------------
// Placa (padrão antigo ABC1234 e Mercosul ABC1D23)
// ---------------------------------------------------------------------------
export function normalizarPlaca(placa: string) {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function placaValida(placa: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizarPlaca(placa));
}
export function formatarPlaca(placa: string) {
  const p = normalizarPlaca(placa);
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function nomeVeiculo(v: Pick<Veiculo, "apelido" | "marca" | "modelo">) {
  return v.apelido?.trim() || [v.marca, v.modelo].filter(Boolean).join(" ") || "Meu veículo";
}

// ---------------------------------------------------------------------------
// Apontamentos (o que a oficina identificou no veículo)
// ---------------------------------------------------------------------------
export type Apontamento = {
  id: string;
  veiculo_id: string;
  categoria: Categoria;
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  fotos: string[];
  situacao: SituacaoApontamento;
  mensagem_cliente: string | null;
  respondido_em: string | null;
  criado_em: string;
};

export const PRIORIDADES = {
  urgente: { rotulo: "Urgente", classe: "bg-perigo-claro text-perigo", ordem: 0 },
  media: { rotulo: "Recomendado", classe: "bg-alerta-claro text-[#8a5a00]", ordem: 1 },
  baixa: { rotulo: "Quando puder", classe: "bg-fundo text-suave", ordem: 2 },
} as const;
export type Prioridade = keyof typeof PRIORIDADES;

export const SITUACOES_APONTAMENTO = {
  pendente: { rotulo: "Aguardando você", rotuloEmpresa: "Aguardando cliente", aberto: true },
  orcamento: { rotulo: "Orçamento solicitado", rotuloEmpresa: "Pediu orçamento", aberto: true },
  agendamento: { rotulo: "Agendamento solicitado", rotuloEmpresa: "Quer agendar", aberto: true },
  agendado: { rotulo: "Agendado", rotuloEmpresa: "Agendado", aberto: true },
  concluido: { rotulo: "Concluído", rotuloEmpresa: "Concluído", aberto: false },
  recusado: { rotulo: "Deixado para depois", rotuloEmpresa: "Cliente recusou", aberto: false },
} as const;
export type SituacaoApontamento = keyof typeof SITUACOES_APONTAMENTO;

export const apontamentoAberto = (a: Pick<Apontamento, "situacao">) => SITUACOES_APONTAMENTO[a.situacao].aberto;

export function formatarDataHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Documentos e vencimentos
// ---------------------------------------------------------------------------
export const TIPOS_DOCUMENTO = {
  licenciamento: { rotulo: "Licenciamento (CRLV)", icone: "📄", doVeiculo: true, dica: "O prazo depende do estado e do final da placa. Confira no site do Detran." },
  ipva: { rotulo: "IPVA", icone: "💰", doVeiculo: true, dica: "Data da cota única ou da próxima parcela." },
  seguro: { rotulo: "Seguro", icone: "🛡️", doVeiculo: true, dica: "Data de fim da vigência da apólice." },
  cnh: { rotulo: "CNH", icone: "🪪", doVeiculo: false, dica: "Data de validade impressa na carteira." },
  outro: { rotulo: "Outro", icone: "📌", doVeiculo: true, dica: "" },
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export type Documento = {
  id: string;
  dono_id: string;
  veiculo_id: string | null;
  tipo: TipoDocumento;
  descricao: string | null;
  vencimento: string; // AAAA-MM-DD
};

export function situacaoDocumento(vencimento: string, hoje = hojeISO()) {
  const dias = diasEntre(hoje, vencimento);
  const situacao: Situacao = dias < 0 ? "vencida" : dias <= AVISO_DIAS ? "em_breve" : "em_dia";
  return { situacao, dias };
}

export function somarDias(dataISO: string, dias: number) {
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
