import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterVeiculo } from "@/lib/dados";
import { hojeISO, nomeVeiculo } from "@/lib/garagem";
import { FormServico } from "./FormServico";

export const metadata: Metadata = { title: "Registrar serviço" };

export default async function NovoServicoPage({ params }: PageProps<"/garagem/[id]/servicos/novo">) {
  const [{ id }, usuario] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href={`/garagem/${id}`}>{nomeVeiculo(veiculo)}</Voltar>
      <h1 className="text-2xl font-bold">Registrar serviço</h1>
      {usuario.papel !== "admin" && (
        <p className="text-sm text-suave">
          Registre aqui serviços feitos em outros lugares para manter o histórico completo. Os serviços feitos
          pela Sempre Zero são registrados pela nossa equipe.
        </p>
      )}
      <Cartao>
        <FormServico
          veiculoId={veiculo.id}
          donoId={veiculo.dono_id}
          kmAtual={veiculo.km_atual}
          hoje={hojeISO()}
          admin={usuario.papel === "admin"}
        />
      </Cartao>
    </div>
  );
}
