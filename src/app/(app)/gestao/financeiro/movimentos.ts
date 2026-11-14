import "server-only";
import { arred, datasDaFatura, nomeMes, rotuloSerie, type Cartao, type CategoriaFinanceira, type Conta, type Lancamento } from "@/lib/gestao";

/** Uma linha das movimentações: um lançamento, ou o pagamento (ou a fatura em aberto) de um cartão. */
export type Mov = {
  chave: string;
  data: string;
  tipo: "entrada" | "saida";
  transferencia: boolean;
  descricao: string;
  detalhe?: string | null;
  valor: number;
  contaId: string | null;
  conta?: string;
  categoria?: string;
  pago: boolean;
  href?: string;
  lancamento?: Lancamento;
};

/** Data que aparece na lista: quando foi pago, ou o vencimento (ou a competência). */
export const dataDe = (l: Lancamento) => (l.pago ? (l.pago_em ?? l.data) : (l.vencimento ?? l.data));

/**
 * Monta as movimentações de um período. Compras no cartão não aparecem uma a uma:
 * entra o pagamento de cada fatura (ou a fatura ainda em aberto, no vencimento).
 * `atrasados`: também traz o que ficou sem pagar antes do período.
 */
export function montarMovimentos({
  de,
  ate,
  lancamentos,
  pendentes = [],
  compras,
  cartoes,
  categorias,
  contas,
}: {
  de: string;
  ate: string;
  lancamentos: Lancamento[];
  pendentes?: Lancamento[];
  compras: Lancamento[];
  cartoes: Cartao[];
  categorias: CategoriaFinanceira[];
  contas: Conta[];
}): Mov[] {
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));

  const mapa = new Map<string, Lancamento>();
  for (const l of lancamentos) if (!l.cartao_id && dataDe(l) >= de && dataDe(l) <= ate) mapa.set(l.id, l);
  for (const l of pendentes) if (!l.cartao_id && !l.pago && dataDe(l) < de) mapa.set(l.id, l);
  const movs: Mov[] = [...mapa.values()].map((l) => {
    const c = cat.get(l.categoria_id ?? "");
    return {
      chave: l.id,
      data: dataDe(l),
      tipo: l.tipo,
      transferencia: c?.dre === "fora",
      descricao: l.descricao,
      detalhe: rotuloSerie(l),
      valor: l.valor,
      contaId: l.conta_id,
      conta: nomeConta.get(l.conta_id ?? ""),
      categoria: c?.nome,
      pago: l.pago,
      href: l.os_id ? `/gestao/os/${l.os_id}` : l.fatura_id ? `/gestao/faturas/${l.fatura_id}` : undefined,
      lancamento: l,
    };
  });

  const faturas = new Map<string, Mov>();
  for (const l of compras) {
    const cartao = cartoes.find((k) => k.id === l.cartao_id);
    if (!cartao || !l.fatura_mes) continue;
    const pago = l.pago && Boolean(l.pago_em);
    const chave = pago ? `${cartao.id}|${l.fatura_mes}|${l.pago_em}|${l.conta_id}` : `${cartao.id}|${l.fatura_mes}|aberta`;
    const atual = faturas.get(chave);
    if (atual) {
      atual.valor = arred(atual.valor + l.valor);
      continue;
    }
    const contaId = pago ? l.conta_id : cartao.conta_pagamento_id;
    faturas.set(chave, {
      chave: `fatura-${chave}`,
      data: pago ? (l.pago_em as string) : datasDaFatura(l.fatura_mes, cartao).vencimento,
      tipo: "saida",
      transferencia: false,
      descricao: pago ? `Pagamento da fatura · ${cartao.nome}` : `Fatura do cartão · ${cartao.nome}`,
      detalhe: `Fatura de ${nomeMes(l.fatura_mes)}`,
      valor: l.valor,
      contaId,
      conta: nomeConta.get(contaId ?? "") ?? `💳 ${cartao.nome}`,
      categoria: "Fatura de cartão",
      pago,
      href: `/gestao/financeiro/cartoes/${cartao.id}?fatura=${l.fatura_mes}`,
    });
  }
  for (const f of faturas.values()) if ((f.data >= de && f.data <= ate) || (!f.pago && f.data < de && pendentes.length)) movs.push(f);
  return movs;
}
