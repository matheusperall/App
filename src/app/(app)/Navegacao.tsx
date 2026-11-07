import { getUsuarioAtual } from "@/lib/auth";
import { LinksNavegacao, type ItemNav } from "./LinksNavegacao";

export async function Navegacao({ local }: { local: "topo" | "rodape" }) {
  const usuario = await getUsuarioAtual();
  const admin = usuario?.papel === "admin";

  const itens: ItemNav[] = [
    ...(admin ? [{ href: "/painel", rotulo: "Painel", icone: "painel" as const }] : []),
    { href: "/garagem", rotulo: "Garagem", icone: "garagem" },
    { href: "/conta", rotulo: "Conta", icone: "conta" },
  ];

  return <LinksNavegacao itens={itens} local={local} />;
}
