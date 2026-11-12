import type { Metadata } from "next";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { listarProdutos } from "@/lib/gestao-dados";
import { FormServico } from "../FormServico";

export const metadata: Metadata = { title: "Novo serviço" };

export default async function NovoServicoPage() {
  await exigirAdmin();
  const produtos = (await listarProdutos()).filter((p) => p.ativo);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/gestao/catalogo">Serviços</Voltar>
      <h1 className="text-2xl font-bold">Novo serviço</h1>
      <Cartao><FormServico produtos={produtos} /></Cartao>
    </div>
  );
}
