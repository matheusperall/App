import { nomeVeiculo, pastaFotos } from "@/lib/garagem";
import { obterFicha } from "@/lib/gestao-dados";
import type { Metadata } from "next";
import { PaginaFicha } from "@/components/PaginaFicha";
import { notFound } from "next/navigation";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { listarVeiculos, obterVeiculo, urlsDasFotos } from "@/lib/dados";
import { excluirVeiculo } from "../../actions";
import { FormVeiculo } from "../../FormVeiculo";
import { BotaoExcluir } from "@/components/BotaoExcluir";

export const metadata: Metadata = { title: "Editar veículo" };

export default async function EditarVeiculoPage({ params }: PageProps<"/garagem/[id]/editar">) {
  const [{ id }, usuario] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();
  const [fotos, irmaos] = await Promise.all([
    urlsDasFotos([veiculo.foto]),
    // Outros veículos do mesmo cliente, para copiar as preferências
    veiculo.dono_id ? listarVeiculos(veiculo.dono_id) : veiculo.cliente_id ? obterFicha(veiculo.cliente_id).then((f) => f?.veiculos ?? []) : Promise.resolve([]),
  ]);
  const outros = irmaos.filter((v) => v.id !== veiculo.id).map((v) => ({ id: v.id, nome: `${nomeVeiculo(v)} (${v.placa})` }));

  return (
    <PaginaFicha voltar={{ href: `/garagem/${id}`, rotulo: "Voltar ao veículo" }} icone="carro" titulo="Editar veículo" descricao={`${veiculo.placa}`}>
      <Cartao>
        <FormVeiculo outros={outros} veiculo={veiculo} donoId={pastaFotos(veiculo)} fotoUrl={veiculo.foto ? fotos[veiculo.foto] : undefined} />
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
    </PaginaFicha>
  );
}
