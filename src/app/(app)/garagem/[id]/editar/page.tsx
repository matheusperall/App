import { pastaFotos } from "@/lib/garagem";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterVeiculo, urlsDasFotos } from "@/lib/dados";
import { excluirVeiculo } from "../../actions";
import { FormVeiculo } from "../../FormVeiculo";
import { BotaoExcluir } from "@/components/BotaoExcluir";

export const metadata: Metadata = { title: "Editar veículo" };

export default async function EditarVeiculoPage({ params }: PageProps<"/garagem/[id]/editar">) {
  const [{ id }, usuario] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();
  const fotos = await urlsDasFotos([veiculo.foto]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href={`/garagem/${id}`}>Voltar ao veículo</Voltar>
      <h1 className="text-2xl font-bold">Editar veículo</h1>
      <Cartao>
        <FormVeiculo veiculo={veiculo} donoId={pastaFotos(veiculo)} fotoUrl={veiculo.foto ? fotos[veiculo.foto] : undefined} />
      </Cartao>
      <Cartao className="space-y-3">
        <h2 className="font-semibold text-perigo">Excluir veículo</h2>
        <p className="text-sm text-suave">Apaga o veículo, todo o histórico de serviços e os lembretes. Não dá para desfazer.</p>
        <form action={excluirVeiculo}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="voltar" value={veiculo.dono_id !== usuario.id ? "cliente" : ""} />
          <BotaoExcluir mensagem="Excluir este veículo e todo o histórico?">Excluir veículo</BotaoExcluir>
        </form>
      </Cartao>
    </div>
  );
}
