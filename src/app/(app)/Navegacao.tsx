import { getUsuarioAtual } from "@/lib/auth";
import { contarAgendamentosAConfirmar, contarNaoLidas, contarOrcamentosAResponder } from "@/lib/dados";
import { LinksNavegacao, type ItemNav } from "./LinksNavegacao";

/**
 * Menu do app.
 * - "barra": barra branca com ícones abaixo do topo (computador)
 * - "topo": atalhos de Avisos e Conta no canto do topo (computador)
 * - "rodape": barra fixa embaixo (celular)
 */
export async function Navegacao({ local }: { local: "topo" | "barra" | "rodape" }) {
  const usuario = await getUsuarioAtual();
  const admin = usuario?.papel === "admin";
  const [naoLidas, aResponder, aConfirmar] = await Promise.all([
    usuario ? contarNaoLidas(usuario.id) : 0,
    admin ? contarOrcamentosAResponder() : 0,
    admin ? contarAgendamentosAConfirmar() : 0,
  ]);

  const principais: ItemNav[] = [
    admin ? { href: "/painel", rotulo: "Atendimento", icone: "atendimento" } : { href: "/garagem", rotulo: "Garagem", icone: "garagem" },
    ...(admin ? [{ href: "/gestao", rotulo: "Gestão", icone: "gestao" } satisfies ItemNav] : []),
    { href: "/agendamentos", rotulo: "Agenda", icone: "agenda", contador: aConfirmar },
    { href: "/orcamentos", rotulo: "Orçamentos", icone: "orcamentos", contador: aResponder },
  ];
  const pessoais: ItemNav[] = [
    { href: "/notificacoes", rotulo: "Avisos", icone: "avisos", contador: naoLidas },
    { href: "/conta", rotulo: "Conta", icone: "conta" },
  ];

  if (local === "barra") return <LinksNavegacao itens={admin ? [...principais, { href: "/garagem", rotulo: "Minha garagem", icone: "garagem" }] : principais} local="barra" />;
  if (local === "topo") return <LinksNavegacao itens={pessoais} local="topo" />;
  return <LinksNavegacao itens={[...principais, ...pessoais]} local="rodape" />;
}
