import type { SubAba } from "@/components/gestao/Cabecalho";

/** Sub-abas da página do veículo. */
export function abasVeiculo(id: string, ativa: "geral" | "lembretes" | "documentos"): SubAba[] {
  return [
    { href: `/garagem/${id}`, rotulo: "Visão geral", ativa: ativa === "geral", icone: "carro" },
    { href: `/garagem/${id}/manutencoes`, rotulo: "Lembretes de manutenção", ativa: ativa === "lembretes", icone: "chave" },
    { href: `/garagem/${id}/documentos`, rotulo: "Documentos", ativa: ativa === "documentos", icone: "documento" },
  ];
}
