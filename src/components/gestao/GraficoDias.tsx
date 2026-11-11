import { formatarValor } from "@/lib/garagem";

/** Faturamento por dia do mês: barras finas, uma série (cor da marca), dica ao passar o dedo/mouse e tabela de apoio. */
export function GraficoDias({ dias, hoje }: { dias: { dia: string; valor: number }[]; hoje: string }) {
  const max = Math.max(...dias.map((d) => d.valor), 0);
  const melhor = dias.reduce((a, b) => (b.valor > a.valor ? b : a), dias[0]);
  const comValor = dias.filter((d) => d.valor > 0);
  if (max === 0) return <p className="text-sm text-suave">Nenhuma OS concluída neste mês ainda.</p>;
  return (
    <figure className="space-y-2">
      <div className="flex h-36 items-end gap-[2px] border-b border-borda" role="img" aria-label={`Faturamento por dia. Melhor dia: ${melhor.dia.slice(8)}, ${formatarValor(melhor.valor)}`}>
        {dias.map((d) => (
          <div key={d.dia} tabIndex={d.valor > 0 ? 0 : -1} className="group relative flex h-full flex-1 items-end outline-none">
            <div
              className={`w-full rounded-t-[4px] ${d.valor > 0 ? "bg-marca group-hover:bg-marca-escura group-focus:bg-marca-escura" : ""} ${d.dia === hoje ? "ring-2 ring-tinta/20" : ""}`}
              style={{ height: d.valor > 0 ? `${Math.max(3, (d.valor / max) * 100)}%` : 0 }}
            />
            {d.valor > 0 && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-tinta px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus:block">
                Dia {d.dia.slice(8)}: {formatarValor(d.valor)}
              </span>
            )}
          </div>
        ))}
      </div>
      <figcaption className="flex justify-between text-xs text-suave">
        <span>1</span>
        <span>Melhor dia: {melhor.dia.slice(8)}/{melhor.dia.slice(5, 7)} · {formatarValor(melhor.valor)}</span>
        <span>{dias.length}</span>
      </figcaption>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-marca-escura">Ver em tabela</summary>
        <table className="mt-2 w-full text-left">
          <tbody className="divide-y divide-borda">
            {comValor.map((d) => (
              <tr key={d.dia}><td className="py-1">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</td><td className="py-1 text-right tabular-nums">{formatarValor(d.valor)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
