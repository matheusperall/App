import type { OpcaoBusca } from "@/components/ListaBusca";
import { formatarPlaca } from "@/lib/garagem";
import { listarFichas } from "@/lib/gestao-dados";

/** Empresa: todos os veículos dos clientes, para escolher com busca (placa, modelo, nome ou telefone). */
export async function opcoesDeVeiculos(): Promise<OpcaoBusca[]> {
  const fichas = await listarFichas();
  return fichas
    .flatMap((ficha) => ficha.veiculos.map((veiculo) => ({ veiculo, ficha })))
    .sort((a, b) => (b.ficha.ultima_visita ?? "").localeCompare(a.ficha.ultima_visita ?? ""))
    .map(({ veiculo, ficha }) => ({
      id: veiculo.id,
      titulo: veiculo.apelido || `${veiculo.marca} ${veiculo.modelo}`,
      detalhe: [ficha.nome, ficha.telefone].filter(Boolean).join(" · "),
      extra: <span className="font-mono text-sm font-semibold tracking-wider">{formatarPlaca(veiculo.placa)}</span>,
      busca: `${veiculo.placa} ${veiculo.marca} ${veiculo.modelo}`,
    }));
}
