import { formatarValor } from "@/lib/garagem";

const SERIES: Record<string, { rotulo: string; cor: string }> = {
  pix: { rotulo: "Pix", cor: "#12b5b0" },
  debito: { rotulo: "Débito", cor: "#e3a008" },
  credito: { rotulo: "Crédito", cor: "#6d5bd0" },
  dinheiro: { rotulo: "Dinheiro", cor: "#1f9d55" },
  transferencia: { rotulo: "Transferência", cor: "#3a7be0" },
  faturas: { rotulo: "Faturas", cor: "#e0603a" },
};

/** Recebido no mês por forma de pagamento: uma barra por forma, com valor e nome escritos. */
export function GraficoFormas({ dados }: { dados: { chave: string; valor: number }[] }) {
  const max = Math.max(...dados.map((d) => d.valor), 0);
  if (max === 0) return <p className="py-8 text-center text-sm text-suave">Nenhum recebimento neste mês ainda.</p>;
  return (
    <figure>
      <div className="flex h-44 items-end gap-2 border-b border-borda sm:gap-3" role="img" aria-label={dados.map((d) => `${SERIES[d.chave]?.rotulo}: ${formatarValor(d.valor)}`).join("; ")}>
        {dados.map((d) => (
          <div key={d.chave} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {d.valor > 0 && <span className="text-[10px] font-semibold whitespace-nowrap tabular-nums sm:text-xs">{formatarValor(d.valor).replace(",00", "")}</span>}
            <div className="w-full max-w-10 rounded-t-[4px]" style={{ height: d.valor > 0 ? `${Math.max(3, (d.valor / max) * 80)}%` : 0, background: SERIES[d.chave]?.cor }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex gap-2 sm:gap-3">
        {dados.map((d) => (
          <span key={d.chave} className="flex flex-1 items-center justify-center gap-1 text-center text-[10px] text-suave sm:text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES[d.chave]?.cor }} />
            <span className="truncate">{SERIES[d.chave]?.rotulo}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
