import type { Metadata } from "next";
import { PaginaFicha } from "@/components/PaginaFicha";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { hojeISO } from "@/lib/garagem";
import { listarCartoes, listarCategorias, listarContas } from "@/lib/gestao-dados";
import { FormLancamento } from "../FormLancamento";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NovoLancamentoPage() {
  await exigirAdmin();
  const [categorias, contas, cartoes] = await Promise.all([listarCategorias(), listarContas(), listarCartoes()]);
  return (
    <PaginaFicha voltar={{ href: "/gestao/financeiro", rotulo: "Financeiro" }} icone="financeiro" titulo="Novo lançamento" descricao="Entradas e saídas do caixa: despesas, compras no cartão, contas fixas e parceladas.">
      <Cartao><FormLancamento categorias={categorias} contas={contas.filter((c) => c.ativa)} hoje={hojeISO()} cartoes={cartoes.filter((c) => c.ativo).map(({ id, nome }) => ({ id, nome }))} /></Cartao>
    </PaginaFicha>
  );
}
