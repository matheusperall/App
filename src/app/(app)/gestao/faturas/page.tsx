import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, SeloFatura, Titulo, Vazio } from "@/components/gestao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, hojeISO, somarDias } from "@/lib/garagem";
import { faturaEmAberto, type OrdemServico } from "@/lib/gestao";
import { listarFaturas, osParaFaturar } from "@/lib/gestao-dados";
import { GerarFatura } from "./GerarFatura";

export const metadata: Metadata = { title: "Faturas de lojistas" };

const FILTROS = [
  { chave: "abertas", rotulo: "Em aberto" },
  { chave: "vencidas", rotulo: "Vencidas" },
  { chave: "pagas", rotulo: "Pagas" },
  { chave: "todas", rotulo: "Todas" },
] as const;

export default async function FaturasPage({ searchParams }: PageProps<"/gestao/faturas">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const filtro = FILTROS.find((f) => f.chave === sp.f)?.chave ?? "abertas";
  const [faturas, aFaturar] = await Promise.all([listarFaturas(), osParaFaturar()]);
  const hoje = hojeISO();

  const porLojista = new Map<string, { nome: string; os: OrdemServico[] }>();
  for (const o of aFaturar) {
    const g = porLojista.get(o.cliente_id) ?? { nome: o.cliente?.nome ?? "Lojista", os: [] };
    g.os.push(o);
    porLojista.set(o.cliente_id, g);
  }

  const lista = faturas.filter((f) =>
    filtro === "abertas" ? faturaEmAberto(f) : filtro === "vencidas" ? faturaEmAberto(f) && f.vencimento < hoje : filtro === "pagas" ? f.situacao === "paga" : true,
  );

  return (
    <div className="space-y-5">
      <Titulo pre="Gestão" titulo="Faturas de lojistas" />

      <Cartao className="space-y-4">
        <div>
          <h2 className="font-semibold">A faturar</h2>
          <p className="text-sm text-suave">OS de lojistas prontas ou entregues que ainda não entraram em fatura.</p>
        </div>
        {porLojista.size === 0 ? (
          <p className="text-sm text-suave">Nada a faturar no momento.</p>
        ) : (
          [...porLojista].map(([id, g]) => (
            <div key={id} className="rounded-xl border border-borda p-4">
              <GerarFatura
                clienteId={id}
                nome={g.nome}
                vencimentoPadrao={somarDias(hoje, 10)}
                os={g.os.map((o) => ({ id: o.id, numero: o.numero, data: o.data, placa: o.placa, veiculo_nome: o.veiculo_nome, servicos: o.itens.map((i) => i.nome).join(", "), total: o.total }))}
              />
            </div>
          ))
        )}
      </Cartao>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link key={f.chave} href={`/gestao/faturas?f=${f.chave}`} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filtro === f.chave ? "border-tinta bg-tinta text-white" : "border-borda bg-white text-suave hover:text-texto"}`}>
            {f.rotulo}
          </Link>
        ))}
      </div>

      <Cartao className="p-0">
        {lista.length === 0 ? (
          <Vazio>Nenhuma fatura aqui.</Vazio>
        ) : (
          <ul className="divide-y divide-borda">
            {lista.map((f) => (
              <li key={f.id}>
                <Link href={`/gestao/faturas/${f.id}`} className="flex items-start justify-between gap-3 px-5 py-4 transition hover:bg-fundo">
                  <div className="min-w-0">
                    <p className="font-medium"><span className="text-suave">#{f.numero}</span> {f.cliente?.nome}</p>
                    <p className="text-sm text-suave">{formatarData(f.periodo_inicio)} a {formatarData(f.periodo_fim)} · vence {formatarData(f.vencimento)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Dinheiro valor={f.total} className="font-semibold" />
                    {f.situacao === "parcial" && <span className="text-xs text-suave">falta <Dinheiro valor={f.total - f.valor_pago} /></span>}
                    <SeloFatura f={f} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
