import { getUsuarioAtual } from "@/lib/auth";
import { contarAgendamentosAConfirmar, contarNaoLidas, contarOrcamentosAResponder } from "@/lib/dados";
import { LinksNavegacao, type ItemNav } from "./LinksNavegacao";

export async function Navegacao({ local }: { local: "topo" | "rodape" }) {
  const usuario = await getUsuarioAtual();
  const admin = usuario?.papel === "admin";
  const [naoLidas, aResponder, aConfirmar] = await Promise.all([
    usuario ? contarNaoLidas(usuario.id) : 0,
    admin ? contarOrcamentosAResponder() : 0,
    admin ? contarAgendamentosAConfirmar() : 0,
  ]);

  const itens: ItemNav[] = [
    // A empresa acessa a própria garagem pelo Painel (espaço na barra é limitado)
    admin ? { href: "/painel", rotulo: "Painel", icone: "painel" } : { href: "/garagem", rotulo: "Garagem", icone: "garagem" },
    { href: "/agendamentos", rotulo: "Agenda", icone: "agenda", contador: aConfirmar },
    { href: "/orcamentos", rotulo: "Orçamentos", icone: "orcamentos", contador: aResponder },
    { href: "/notificacoes", rotulo: "Avisos", icone: "avisos", contador: naoLidas },
    { href: "/conta", rotulo: "Conta", icone: "conta" },
  ];

  return <LinksNavegacao itens={itens} local={local} />;
}
