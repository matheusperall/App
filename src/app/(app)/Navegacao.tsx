import { getUsuarioAtual } from "@/lib/auth";
import { contarNaoLidas, contarOrcamentosAResponder } from "@/lib/dados";
import { LinksNavegacao, type ItemNav } from "./LinksNavegacao";

export async function Navegacao({ local }: { local: "topo" | "rodape" }) {
  const usuario = await getUsuarioAtual();
  const admin = usuario?.papel === "admin";
  const [naoLidas, aResponder] = await Promise.all([
    usuario ? contarNaoLidas(usuario.id) : 0,
    admin ? contarOrcamentosAResponder() : 0,
  ]);

  const itens: ItemNav[] = [
    ...(admin ? [{ href: "/painel", rotulo: "Painel", icone: "painel" as const }] : []),
    { href: "/garagem", rotulo: "Garagem", icone: "garagem" },
    { href: "/orcamentos", rotulo: "Orçamentos", icone: "orcamentos", contador: aResponder },
    { href: "/notificacoes", rotulo: "Avisos", icone: "avisos", contador: naoLidas },
    { href: "/conta", rotulo: "Conta", icone: "conta" },
  ];

  return <LinksNavegacao itens={itens} local={local} />;
}
