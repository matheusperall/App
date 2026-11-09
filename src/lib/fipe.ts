// Tabela FIPE (gratuita) — tipos e utilitários usados no cliente e no servidor.

export const TIPOS_VEICULO = {
  carro: { rotulo: "Carro", caminho: "carros", icone: "🚗" },
  moto: { rotulo: "Moto", caminho: "motos", icone: "🏍️" },
  caminhao: { rotulo: "Caminhão", caminho: "caminhoes", icone: "🚚" },
} as const;
export type TipoVeiculo = keyof typeof TIPOS_VEICULO;

export type ItemFipe = { codigo: string; nome: string };

export type DetalheFipe = {
  marca: string;
  modelo: string;
  ano: number;
  combustivel: string;
  codigoFipe: string;
  valor: number | null;
  referencia: string;
};

/** "VW - VolksWagen" → "Volkswagen", "GM - Chevrolet" → "Chevrolet" */
export function nomeMarca(nome: string) {
  const especiais: Record<string, string> = { "VW - VolksWagen": "Volkswagen", "GM - Chevrolet": "Chevrolet" };
  if (especiais[nome]) return especiais[nome];
  const partes = nome.split(" - ");
  return (partes.length > 1 ? partes[partes.length - 1] : nome).trim();
}

/** "R$ 120.345,00" → 120345 */
export function valorFipe(texto: string | undefined) {
  if (!texto) return null;
  const n = Number(texto.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Ano 32000 é "Zero KM" na FIPE. */
export function anoFipe(anoModelo: number, anoAtual: number) {
  return anoModelo >= 32000 ? anoAtual : anoModelo;
}

/** Converte a resposta de detalhes da API FIPE. */
export function lerDetalhe(d: Record<string, unknown>, anoAtual: number): DetalheFipe {
  return {
    marca: nomeMarca(String(d.Marca ?? "")),
    modelo: String(d.Modelo ?? "").trim(),
    ano: anoFipe(Number(d.AnoModelo ?? 0), anoAtual),
    combustivel: String(d.Combustivel ?? "").trim(),
    codigoFipe: String(d.CodigoFipe ?? "").trim(),
    valor: valorFipe(String(d.Valor ?? "")),
    referencia: String(d.MesReferencia ?? "").trim(),
  };
}

// ---------------------------------------------------------------------------
// Modelo básico (ex.: "Polo") a partir dos nomes completos da FIPE
// ---------------------------------------------------------------------------
/** Palavras que formam o nome do modelo junto com a seguinte (ex.: "Grand Siena", "Space Fox"). */
const UNE_SEGUINTE = new Set(["grand", "nova", "novo", "new", "range", "classe", "serie", "série", "space", "santa"]);

function normalizarPalavra(p: string) {
  // "POLO" → "Polo"; mantém siglas com números (HB20, C3, 208) e nomes curtos (UP!, KA)
  if (/\d/.test(p) || p.length <= 3) return p;
  return p === p.toUpperCase() ? p.charAt(0) + p.slice(1).toLowerCase() : p;
}

export function modeloBase(nome: string) {
  const limpo = nome.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const partes = limpo.split(" ");
  const primeira = partes[0] ?? limpo;
  const usar = UNE_SEGUINTE.has(primeira.toLowerCase()) && partes[1] && !/^\d/.test(partes[1]) ? 2 : 1;
  const nomeBase = partes.slice(0, usar).map(normalizarPalavra).join(" ");
  return { chave: nomeBase.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), nome: nomeBase };
}

export type ModeloBasico = { chave: string; nome: string; versoes: number };

/** Agrupa as versões da FIPE pelo modelo básico. */
export function agruparModelos(modelos: ItemFipe[]): ModeloBasico[] {
  const grupos = new Map<string, { nomes: Map<string, number>; versoes: number }>();
  for (const m of modelos) {
    const b = modeloBase(m.nome);
    const g = grupos.get(b.chave) ?? { nomes: new Map(), versoes: 0 };
    g.nomes.set(b.nome, (g.nomes.get(b.nome) ?? 0) + 1);
    g.versoes++;
    grupos.set(b.chave, g);
  }
  return [...grupos.entries()]
    .map(([chave, g]) => ({ chave, nome: [...g.nomes.entries()].sort((a, b) => b[1] - a[1])[0][0], versoes: g.versoes }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "2021 Gasolina" → { ano: 2021, combustivel: "Gasolina" }; "32000 Flex" = Zero KM */
export function lerAnoFipe(nome: string, anoAtual: number) {
  const m = nome.match(/^(\d{4,5})\s*(.*)$/);
  const bruto = m ? Number(m[1]) : 0;
  return { ano: bruto >= 32000 ? anoAtual : bruto, zeroKm: bruto >= 32000, combustivel: (m?.[2] ?? "").trim() };
}

/** Versões disponíveis por ano para um modelo básico. */
export type AnoComVersoes = {
  ano: number;
  zeroKm: boolean;
  versoes: { modeloCod: string; nome: string; anoCod: string; combustivel: string }[];
};
