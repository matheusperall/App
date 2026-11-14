/** Onde cada categoria entra no resultado do mês (DRE). */
export const GRUPOS_DRE = {
  entrada: [
    { valor: "receita", rotulo: "Receita" },
    { valor: "fora", rotulo: "Fora do resultado (aporte, transferência)" },
  ],
  saida: [
    { valor: "despesa", rotulo: "Despesa" },
    { valor: "taxa", rotulo: "Taxas de cartão" },
    { valor: "estoque", rotulo: "Compra de produtos (vira estoque)" },
    { valor: "fora", rotulo: "Fora do resultado (retirada, transferência)" },
  ],
} as const;

export const rotuloDre = (tipo: "entrada" | "saida", dre: string) => GRUPOS_DRE[tipo].find((g) => g.valor === dre)?.rotulo ?? dre;
