import type { Metadata } from "next";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { hojeISO } from "@/lib/garagem";
import { listarCategorias, listarContas } from "@/lib/gestao-dados";
import { FormLancamento } from "../FormLancamento";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NovoLancamentoPage() {
  await exigirAdmin();
  const [categorias, contas] = await Promise.all([listarCategorias(), listarContas()]);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/gestao/financeiro">Financeiro</Voltar>
      <h1 className="text-2xl font-bold">Novo lançamento</h1>
      <Cartao><FormLancamento categorias={categorias} contas={contas.filter((c) => c.ativa)} hoje={hojeISO()} /></Cartao>
    </div>
  );
}
