import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaFicha } from "@/components/PaginaFicha";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { listarCatalogo, listarProdutos } from "@/lib/gestao-dados";
import { FormServico } from "../FormServico";

export const metadata: Metadata = { title: "Serviço" };

export default async function ServicoCatalogoPage({ params }: PageProps<"/gestao/catalogo/[servicoId]">) {
  const [{ servicoId }] = await Promise.all([params, exigirAdmin()]);
  const [catalogo, produtos] = await Promise.all([listarCatalogo(), listarProdutos()]);
  const servico = catalogo.find((s) => s.id === servicoId);
  if (!servico) notFound();
  return (
    <PaginaFicha voltar={{ href: "/gestao/catalogo", rotulo: "Serviços" }} icone="servicos" titulo={servico.nome} descricao="Preço, categoria e os produtos que o serviço gasta.">
      <Cartao><FormServico servico={servico} produtos={produtos.filter((p) => p.ativo || servico.consumo.some((c) => c.produto_id === p.id))} /></Cartao>
    </PaginaFicha>
  );
}
