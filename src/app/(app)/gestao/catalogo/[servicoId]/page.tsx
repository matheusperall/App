import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
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
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/gestao/catalogo">Serviços</Voltar>
      <h1 className="text-2xl font-bold">{servico.nome}</h1>
      <Cartao><FormServico servico={servico} produtos={produtos.filter((p) => p.ativo || servico.consumo.some((c) => c.produto_id === p.id))} /></Cartao>
    </div>
  );
}
