import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { obterVeiculo } from "@/lib/dados";
import { nomeVeiculo, pastaFotos } from "@/lib/garagem";
import { FormApontamento } from "./FormApontamento";

export const metadata: Metadata = { title: "Novo apontamento" };

export default async function NovoApontamentoPage({ params }: PageProps<"/garagem/[id]/apontamentos/novo">) {
  const [{ id }] = await Promise.all([params, exigirAdmin()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href={`/garagem/${id}`}>{nomeVeiculo(veiculo)}</Voltar>
      <div>
        <h1 className="text-2xl font-bold">Novo apontamento</h1>
        <p className="text-suave">
          {veiculo.dono?.nome ?? "O cliente"} recebe um aviso no celular e por e-mail, e pode pedir orçamento ou
          agendamento direto pelo app.
        </p>
      </div>
      <Cartao>
        <FormApontamento veiculoId={veiculo.id} donoId={pastaFotos(veiculo)} />
      </Cartao>
    </div>
  );
}
