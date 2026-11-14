import type { SubAba } from "@/components/gestao/Cabecalho";

/** Sub-abas do Financeiro. */
export function abasFinanceiro(ativa: "resumo" | "movimentacoes" | "contas" | "resultado" | "categorias", mes?: string): SubAba[] {
  const q = mes ? `?mes=${mes}` : "";
  return [
    { href: `/gestao/financeiro/resumo${q}`, rotulo: "Resumo", ativa: ativa === "resumo", icone: "painel" },
    { href: "/gestao/financeiro", rotulo: "Movimentações", ativa: ativa === "movimentacoes", icone: "financeiro" },
    { href: "/gestao/financeiro/contas", rotulo: "Contas", ativa: ativa === "contas", icone: "conta" },
    { href: `/gestao/financeiro/resultado${q}`, rotulo: "Resultado (DRE)", ativa: ativa === "resultado", icone: "resultado" },
  ];
}
