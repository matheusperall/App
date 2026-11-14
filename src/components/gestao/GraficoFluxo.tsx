"use client";

import { useState } from "react";
import { formatarValor } from "@/lib/garagem";

/* Cores validadas para daltonismo (com linha tracejada nas saídas como segunda pista) */
const COR_ENTRADA = "#1f9d55";
const COR_SAIDA = "#c2410c";

type Dia = { dia: string; entradas: number; saidas: number };

/** Fluxo de caixa diário: entradas e saídas de cada dia do mês, com dica ao passar o dedo/mouse e tabela de apoio. */
export function GraficoFluxo({ dias, hoje }: { dias: Dia[]; hoje: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(1, ...dias.map((d) => Math.max(d.entradas, d.saidas)));
  const L = 1000;
  const A = 220;
  const topo = 12;
  const x = (i: number) => (dias.length <= 1 ? L / 2 : (i / (dias.length - 1)) * L);
  const y = (v: number) => topo + (A - topo) * (1 - v / max);
  const linha = (k: "entradas" | "saidas") => dias.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const area = (k: "entradas" | "saidas") => `${linha(k)} L${x(dias.length - 1)},${A} L${x(0)},${A} Z`;
  const iHoje = dias.findIndex((d) => d.dia === hoje);
  const passos = [0, 0.5, 1].map((f) => max * f);
  const d = ativo != null ? dias[ativo] : null;
  const vazio = dias.every((x) => x.entradas === 0 && x.saidas === 0);

  if (vazio) return <p className="py-8 text-center text-sm text-suave">Nenhuma entrada ou saída neste mês ainda.</p>;

  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-suave" aria-hidden="true">
        <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={COR_ENTRADA} strokeWidth="2" /></svg>Entradas</span>
        <span className="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={COR_SAIDA} strokeWidth="2" strokeDasharray="4 3" /></svg>Saídas</span>
      </div>
      <div className="relative flex gap-2">
        <div className="flex w-16 shrink-0 flex-col justify-between pb-5 text-right text-[10px] text-suave tabular-nums" aria-hidden="true">
          {[...passos].reverse().map((v) => <span key={v}>{formatarValor(Math.round(v)).replace(",00", "")}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${L} ${A}`}
            preserveAspectRatio="none"
            className="h-56 w-full overflow-visible"
            role="img"
            aria-label="Fluxo de caixa diário: entradas e saídas de cada dia do mês"
            onMouseLeave={() => setAtivo(null)}
          >
            {passos.map((v) => <line key={v} x1="0" x2={L} y1={y(v)} y2={y(v)} stroke="#e2e7ee" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            {iHoje >= 0 && <line x1={x(iHoje)} x2={x(iHoje)} y1={topo} y2={A} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
            <path d={area("entradas")} fill={COR_ENTRADA} fillOpacity="0.1" />
            <path d={area("saidas")} fill={COR_SAIDA} fillOpacity="0.08" />
            <path d={linha("entradas")} fill="none" stroke={COR_ENTRADA} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={linha("saidas")} fill="none" stroke={COR_SAIDA} strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {ativo != null && <line x1={x(ativo)} x2={x(ativo)} y1={topo} y2={A} stroke="#0b1220" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
            {/* Áreas de toque, uma por dia */}
            {dias.map((dd, i) => (
              <rect
                key={dd.dia}
                x={x(i) - L / dias.length / 2}
                y="0"
                width={L / dias.length}
                height={A}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
                onClick={() => setAtivo(i)}
              />
            ))}
          </svg>
          {/* Pontos do dia em destaque (fora do SVG esticado, para ficarem redondos) */}
          {d && ativo != null && (
            <>
              <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${(x(ativo) / L) * 100}%`, top: `${(y(d.entradas) / A) * 224}px`, background: COR_ENTRADA }} />
              <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${(x(ativo) / L) * 100}%`, top: `${(y(d.saidas) / A) * 224}px`, background: COR_SAIDA }} />
              <div
                className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg bg-tinta px-3 py-2 text-xs text-white shadow-lg"
                style={{ left: `clamp(0px, calc(${(x(ativo) / L) * 100}% - 5.5rem), calc(100% - 11rem))` }}
              >
                <p className="font-semibold">Dia {d.dia.slice(8)}/{d.dia.slice(5, 7)}</p>
                <p className="flex justify-between"><span>Entradas</span><span className="tabular-nums">{formatarValor(d.entradas)}</span></p>
                <p className="flex justify-between"><span>Saídas</span><span className="tabular-nums">{formatarValor(d.saidas)}</span></p>
                <p className="mt-0.5 flex justify-between border-t border-white/20 pt-0.5"><span>Geração</span><span className="tabular-nums">{formatarValor(d.entradas - d.saidas)}</span></p>
              </div>
            </>
          )}
          <div className="mt-1 flex justify-between text-[10px] text-suave tabular-nums" aria-hidden="true">
            {dias.filter((_, i) => i % 2 === 0 || i === dias.length - 1).map((dd) => <span key={dd.dia}>{dd.dia.slice(8)}</span>)}
          </div>
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-marca-escura">Ver em tabela</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-suave">
            <tr><th className="py-1 font-medium">Dia</th><th className="py-1 text-right font-medium">Entradas</th><th className="py-1 text-right font-medium">Saídas</th><th className="py-1 text-right font-medium">Geração</th></tr>
          </thead>
          <tbody>
            {dias.filter((dd) => dd.entradas || dd.saidas).map((dd) => (
              <tr key={dd.dia} className="border-t border-borda">
                <td className="py-1">{dd.dia.slice(8)}/{dd.dia.slice(5, 7)}</td>
                <td className="py-1 text-right">{formatarValor(dd.entradas)}</td>
                <td className="py-1 text-right">{formatarValor(dd.saidas)}</td>
                <td className="py-1 text-right">{formatarValor(dd.entradas - dd.saidas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
