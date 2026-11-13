import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaFicha } from "@/components/PaginaFicha";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterVeiculo } from "@/lib/dados";
import { hojeISO, nomeVeiculo, pastaFotos } from "@/lib/garagem";
import { FormServico } from "./FormServico";

export const metadata: Metadata = { title: "Registrar serviço" };

export default async function NovoServicoPage({ params }: PageProps<"/garagem/[id]/servicos/novo">) {
  const [{ id }, usuario] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();

  return (
    <PaginaFicha
      voltar={{ href: `/garagem/${id}`, rotulo: nomeVeiculo(veiculo) }}
      icone="chave"
      titulo="Registrar serviço"
      descricao={
        usuario.papel !== "admin"
          ? "Registre aqui serviços feitos em outros lugares para manter o histórico completo. Os serviços feitos pela Sempre Zero são registrados pela nossa equipe."
          : `${nomeVeiculo(veiculo)} (${veiculo.placa})`
      }
    >
      <Cartao>
        <FormServico
          veiculoId={veiculo.id}
          donoId={pastaFotos(veiculo)}
          kmAtual={veiculo.km_atual}
          hoje={hojeISO()}
          admin={usuario.papel === "admin"}
        />
      </Cartao>
    </PaginaFicha>
  );
}
