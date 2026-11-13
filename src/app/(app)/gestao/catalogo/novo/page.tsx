import type { Metadata } from "next";
import { PaginaFicha } from "@/components/PaginaFicha";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { listarProdutos } from "@/lib/gestao-dados";
import { FormServico } from "../FormServico";

export const metadata: Metadata = { title: "Novo serviço" };

export default async function NovoServicoPage() {
  await exigirAdmin();
  const produtos = (await listarProdutos()).filter((p) => p.ativo);
  return (
    <PaginaFicha voltar={{ href: "/gestao/catalogo", rotulo: "Serviços" }} icone="servicos" titulo="Novo serviço" descricao="O que a loja vende: preço e os produtos que o serviço gasta.">
      <Cartao><FormServico produtos={produtos} /></Cartao>
    </PaginaFicha>
  );
}
