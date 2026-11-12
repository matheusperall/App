import type { Metadata } from "next";
import Link from "next/link";
import { Titulo } from "@/components/gestao";
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
      <Titulo pre="Gestão" titulo="Serviços">
        <Link href="/gestao/catalogo/novo" className="botao-primario px-4 py-2.5 text-sm">+ Serviço</Link>
      </Titulo>
      {sp.salvo && <Aviso tipo="sucesso">Serviço cadastrado.</Aviso>}
      <p className="text-sm text-suave">O que a loja vende, com preço, custo dos produtos e margem. Toque em um serviço para editar o consumo.</p>
      <ListaCatalogo servicos={servicos} />
    </div>
  );
}
