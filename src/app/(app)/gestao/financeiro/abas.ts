import type { SubAba } from "@/components/gestao/Cabecalho";

/** Sub-abas do Financeiro. */
export function abasFinanceiro(ativa: "movimentacoes" | "contas" | "resultado", mes?: string): SubAba[] {
  const q = mes ? `?mes=${mes}` : "";
  return [
    { href: `/gestao/financeiro${q}`, rotulo: "Movimentações", ativa: ativa === "movimentacoes", icone: "financeiro" },
    { href: "/gestao/financeiro/contas", rotulo: "Contas", ativa: ativa === "contas", icone: "conta" },
    { href: `/gestao/financeiro/resultado${q}`, rotulo: "Resultado (DRE)", ativa: ativa === "resultado", icone: "resultado" },
  ];
}
