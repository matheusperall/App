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
