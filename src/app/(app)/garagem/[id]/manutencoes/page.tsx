import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { abasVeiculo } from "../abas";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { exigirUsuario } from "@/lib/auth";
import { listarManutencoes, obterVeiculo } from "@/lib/dados";
import { TIPOS_MANUTENCAO, nomeVeiculo, type TipoManutencao } from "@/lib/garagem";
import { FormManutencao } from "./FormManutencao";

export const metadata: Metadata = { title: "Lembretes de manutenção" };

export default async function ManutencoesPage({ params }: PageProps<"/garagem/[id]/manutencoes">) {
  const [{ id }] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();
  const manutencoes = await listarManutencoes([id]);
  const tipos = Object.keys(TIPOS_MANUTENCAO) as TipoManutencao[];
  // Ativos primeiro
  tipos.sort((a, b) => Number(!manutencoes.some((m) => m.tipo === a)) - Number(!manutencoes.some((m) => m.tipo === b)));

  return (
    <div className="space-y-4">
      <Voltar href={`/garagem/${id}`}>{nomeVeiculo(veiculo)}</Voltar>
      <Cabecalho icone="carro" titulo={`${nomeVeiculo(veiculo)} · ${veiculo.placa}`} abas={abasVeiculo(id, "lembretes")} />
      <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Lembretes de manutenção</h2>
        <p className="text-suave">
          Os intervalos sugeridos são comuns de mercado. Ajuste conforme o manual do seu carro ou a
          recomendação da oficina. Avisamos o que vier primeiro: a data ou a quilometragem.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {tipos.map((t) => (
          <FormManutencao
            key={t}
            veiculoId={id}
            tipo={t}
            kmAtual={veiculo.km_atual}
            atual={manutencoes.find((m) => m.tipo === t) ?? null}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
