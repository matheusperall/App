/** Filtros das movimentações: cada grupo é uma lista na URL (separada por vírgula). */
export type ValoresFiltro = {
  de: string;
  ate: string;
  contas: string[];
  tipo: string[];
  situacao: string[];
  recorrencia: string[];
  q: string;
};

export const GRUPOS_FILTRO = [
  { titulo: "Tipo", lista: "tipo", itens: [["entradas", "Entrada"], ["saidas", "Saída"], ["transferencias", "Transferências"]] },
  { titulo: "Entradas", lista: "situacao", itens: [["recebidas", "Recebidas"], ["a_receber", "A receber"], ["receber_vencidas", "Vencidas"]] },
  { titulo: "Saídas", lista: "situacao", itens: [["pagas", "Pagas"], ["a_pagar", "A pagar"], ["vencidas", "Vencidas"]] },
  { titulo: "Recorrência", lista: "recorrencia", itens: [["fixas", "Fixas"], ["variaveis", "Variáveis"]] },
] as const satisfies readonly { titulo: string; lista: "tipo" | "situacao" | "recorrencia"; itens: readonly (readonly [string, string])[] }[];

const valoresDe = (lista: string) => GRUPOS_FILTRO.filter((g) => g.lista === lista).flatMap((g) => g.itens.map(([k]) => k as string));

/** Lê uma lista da URL, aceitando só as chaves conhecidas. */
export function lerLista(v: string | string[] | undefined, lista: "tipo" | "situacao" | "recorrencia") {
  const validas = valoresDe(lista);
  return typeof v === "string" ? v.split(",").filter((x) => validas.includes(x)) : [];
}
