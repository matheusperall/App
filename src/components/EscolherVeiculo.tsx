import Link from "next/link";
import { Placa } from "@/components/garagem";
import { Icone } from "@/components/gestao/Icones";
import { normalizarPlaca } from "@/lib/garagem";
import { combina } from "@/lib/gestao";
import { listarFichas } from "@/lib/gestao-dados";

/**
 * Empresa: primeiro passo de "Novo agendamento" e "Novo orçamento".
 * Busca o veículo do cliente pela placa, modelo, nome ou telefone e segue com ?veiculo=.
 */
export async function EscolherVeiculo({ busca, destino }: { busca: string; destino: string }) {
  const fichas = await listarFichas();
  const placa = normalizarPlaca(busca);
  const todos = fichas.flatMap((ficha) => ficha.veiculos.map((veiculo) => ({ veiculo, ficha })));
  const itens = busca
    ? todos.filter(
        ({ veiculo, ficha }) =>
          (placa.length >= 2 && veiculo.placa.includes(placa)) ||
          combina(`${veiculo.marca} ${veiculo.modelo} ${veiculo.apelido ?? ""} ${ficha.nome} ${ficha.telefone ?? ""}`, busca),
      )
    : [...todos].sort((a, b) => (b.ficha.ultima_visita ?? "").localeCompare(a.ficha.ultima_visita ?? ""));
  return (
    <section className="space-y-3 rounded-2xl border border-borda bg-white p-4">
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <input name="q" defaultValue={busca} type="search" className="campo flex-1" placeholder="Placa, modelo, nome ou telefone" aria-label="Buscar veículo do cliente" autoFocus />
        <button type="submit" className="botao-primario gap-1.5 rounded-full px-4 py-2.5 text-sm">
          <Icone nome="carro" className="h-4 w-4" />Buscar veículo
        </button>
      </form>
      <p className="px-1 text-sm text-suave">{busca ? `${itens.length} ${itens.length === 1 ? "veículo encontrado" : "veículos encontrados"}` : "Escolha o veículo do cliente (os mais recentes primeiro):"}</p>
      {itens.length > 0 ? (
        <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
          {itens.slice(0, 20).map(({ veiculo, ficha }) => (
            <li key={veiculo.id}>
              <Link href={`${destino}?veiculo=${veiculo.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-fundo">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{veiculo.apelido || `${veiculo.marca} ${veiculo.modelo}`}</span>
                  <span className="block truncate text-sm text-suave">{ficha.nome}{ficha.telefone ? ` · ${ficha.telefone}` : ""}</span>
                </span>
                <span className="shrink-0"><Placa placa={veiculo.placa} tamanho="sm" /></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-suave">
          Nenhum veículo encontrado. Cadastre o cliente em <Link href="/gestao/clientes/novo" className="font-semibold text-marca-escura underline">Gestão › Novo cliente</Link>.
        </p>
      )}
    </section>
  );
}
