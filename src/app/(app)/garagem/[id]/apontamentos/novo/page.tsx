import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaFicha } from "@/components/PaginaFicha";
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
    <PaginaFicha
      voltar={{ href: `/garagem/${id}`, rotulo: nomeVeiculo(veiculo) }}
      icone="aviso"
      titulo="Novo apontamento"
      descricao={`${veiculo.dono?.nome ?? "O cliente"} recebe um aviso no celular e por e-mail, e pode pedir orçamento ou agendamento direto pelo app.`}
    >
      <Cartao>
        <FormApontamento veiculoId={veiculo.id} donoId={pastaFotos(veiculo)} />
      </Cartao>
    </PaginaFicha>
  );
}
