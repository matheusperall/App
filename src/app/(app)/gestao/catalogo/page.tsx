import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { Aviso } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { listarCatalogo } from "@/lib/gestao-dados";
import { ListaCatalogo } from "./ListaCatalogo";

export const metadata: Metadata = { title: "Catálogo de serviços" };

export default async function CatalogoPage({ searchParams }: PageProps<"/gestao/catalogo">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const servicos = await listarCatalogo();
  return (
    <div className="space-y-4">
      <Cabecalho icone="servicos" titulo="Serviços" acao={{ href: "/gestao/catalogo/novo", rotulo: "Novo serviço" }} />
      {sp.salvo && <Aviso tipo="sucesso">Serviço cadastrado.</Aviso>}
      <p className="text-sm text-suave">O que a loja vende, com preço, custo dos produtos e margem. Toque em um serviço para editar o consumo.</p>
      <ListaCatalogo servicos={servicos} />
    </div>
  );
}
