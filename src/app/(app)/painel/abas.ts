import type { SubAba } from "@/components/gestao/Cabecalho";

/** Sub-abas do Atendimento (respostas de clientes, comunicados e configurações). */
export function abasPainel(ativa: "geral" | "comunicados" | "configuracoes"): SubAba[] {
  return [
    { href: "/painel", rotulo: "Visão geral", ativa: ativa === "geral", icone: "atendimento" },
    { href: "/painel/comunicados", rotulo: "Comunicados", ativa: ativa === "comunicados", icone: "megafone" },
    { href: "/painel/configuracoes", rotulo: "Configurações", ativa: ativa === "configuracoes", icone: "servicos" },
  ];
}
