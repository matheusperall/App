import type { SubAba } from "@/components/gestao/Cabecalho";

/** Sub-abas do Painel da empresa. */
export function abasPainel(ativa: "geral" | "comunicados" | "configuracoes"): SubAba[] {
  return [
    { href: "/painel", rotulo: "Visão geral", ativa: ativa === "geral", icone: "painel" },
    { href: "/painel/comunicados", rotulo: "Comunicados", ativa: ativa === "comunicados", icone: "megafone" },
    { href: "/painel/configuracoes", rotulo: "Configurações", ativa: ativa === "configuracoes", icone: "servicos" },
    // Seus veículos pessoais (no celular a barra de baixo não tem espaço para a Garagem)
    { href: "/garagem", rotulo: "Minha garagem", ativa: false, icone: "carro" },
  ];
}
