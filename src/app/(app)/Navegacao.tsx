import { getUsuarioAtual } from "@/lib/auth";
import { contarNaoLidas } from "@/lib/dados";
import { LinksNavegacao, type ItemNav } from "./LinksNavegacao";

export async function Navegacao({ local }: { local: "topo" | "rodape" }) {
  const usuario = await getUsuarioAtual();
  const admin = usuario?.papel === "admin";
  const naoLidas = usuario ? await contarNaoLidas(usuario.id) : 0;

  const itens: ItemNav[] = [
    ...(admin ? [{ href: "/painel", rotulo: "Painel", icone: "painel" as const }] : []),
    { href: "/garagem", rotulo: "Garagem", icone: "garagem" },
    { href: "/notificacoes", rotulo: "Avisos", icone: "avisos", contador: naoLidas },
    { href: "/conta", rotulo: "Conta", icone: "conta" },
  ];

  return <LinksNavegacao itens={itens} local={local} />;
}
