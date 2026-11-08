import Link from "next/link";
import type { OrcamentoComVeiculo } from "@/lib/dados";
import {
  CATEGORIAS,
  SITUACOES_ORCAMENTO,
  formatarData,
  formatarValor,
  nomeVeiculo,
  orcamentoVencido,
  type Orcamento,
} from "@/lib/garagem";

export function SeloOrcamento({ o, empresa = false }: { o: Pick<Orcamento, "situacao" | "validade">; empresa?: boolean }) {
  if (orcamentoVencido(o)) return <span className="shrink-0 rounded-full bg-fundo px-2.5 py-0.5 text-xs font-semibold text-suave">Expirado</span>;
  const s = SITUACOES_ORCAMENTO[o.situacao];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{empresa ? s.rotuloEmpresa : s.rotulo}</span>;
}

export function ItemListaOrcamento({ o, empresa = false }: { o: OrcamentoComVeiculo; empresa?: boolean }) {
  const cat = CATEGORIAS[o.categoria];
  return (
    <li>
      <Link href={`/orcamentos/${o.id}`} className="flex gap-3 px-5 py-4 transition hover:bg-fundo">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fundo text-lg" aria-hidden="true">
          {cat.icone}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">
              Orçamento #{o.numero}
              {o.valor_total != null && <span className="text-suave"> · {formatarValor(o.valor_total)}</span>}
            </p>
            <SeloOrcamento o={o} empresa={empresa} />
          </div>
          <p className="truncate text-sm text-suave">
            {empresa && o.veiculo?.dono?.nome ? `${o.veiculo.dono.nome} · ` : ""}
            {o.veiculo ? `${nomeVeiculo(o.veiculo)} (${o.veiculo.placa})` : ""}
          </p>
          {o.pedido && <p className="mt-0.5 line-clamp-1 text-sm">{o.pedido}</p>}
          <p className="mt-0.5 text-xs text-suave">{cat.rotulo} · pedido em {formatarData(o.criado_em)}</p>
        </div>
      </Link>
    </li>
  );
}

export function TabelaItens({ o }: { o: Pick<Orcamento, "itens" | "valor_total" | "prazo_dias" | "validade" | "observacoes"> }) {
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-left text-xs text-suave">
            <th className="py-2 font-medium">Serviço</th>
            <th className="py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {o.itens.map((i, n) => (
            <tr key={n} className="border-b border-borda/60">
              <td className="py-2.5 pr-3">{i.descricao}</td>
              <td className="py-2.5 text-right whitespace-nowrap">{formatarValor(i.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold">Total</td>
            <td className="pt-3 text-right font-titulo text-xl font-bold whitespace-nowrap">{formatarValor(o.valor_total)}</td>
          </tr>
        </tfoot>
      </table>
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-fundo p-3 text-sm">
        <div>
          <dt className="text-xs text-suave">Prazo de execução</dt>
          <dd className="font-semibold">{o.prazo_dias != null ? `${o.prazo_dias} ${o.prazo_dias === 1 ? "dia" : "dias"}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Válido até</dt>
          <dd className="font-semibold">{formatarData(o.validade)}</dd>
        </div>
      </dl>
      {o.observacoes && <p className="whitespace-pre-line text-sm text-suave">{o.observacoes}</p>}
    </div>
  );
}
