"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export type ValoresFiltro = { de: string; ate: string; contas: string[]; tipo: string; situacao: string; q: string };

export const TIPOS_FILTRO = { "": "Todos", entradas: "Entradas", saidas: "Saídas", transferencias: "Transferências" } as const;
export const SITUACOES_FILTRO = {
  "": "Todas",
  recebidas: "Recebidas",
  a_receber: "A receber",
  pagas: "Pagas",
  a_pagar: "A pagar",
  vencidas: "Vencidas",
} as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
function mesDe(dia: string, desloca = 0) {
  const [a, m] = dia.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 1 + desloca, 1));
  const fim = new Date(Date.UTC(a, m + desloca, 0));
  return { de: iso(ini), ate: iso(fim) };
}

/** Filtros das movimentações: cada mudança já atualiza a página (sem precisar de Enter). */
export function FiltrosMovimentacoes({ contas, valores, hoje }: { contas: { id: string; nome: string }[]; valores: ValoresFiltro; hoje: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(valores.q);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  function aplicar(novo: Partial<ValoresFiltro>) {
    const v = { ...valores, ...novo };
    const q = new URLSearchParams();
    q.set("de", v.de);
    q.set("ate", v.ate);
    if (v.contas.length && v.contas.length < contas.length) q.set("contas", v.contas.join(","));
    if (v.tipo) q.set("tipo", v.tipo);
    if (v.situacao) q.set("situacao", v.situacao);
    if (v.q.trim()) q.set("q", v.q.trim());
    iniciar(() => router.replace(`${caminho}?${q}`, { scroll: false }));
  }

  // Busca: aplica sozinha depois que a pessoa para de digitar
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);
  function mudarBusca(t: string) {
    setBusca(t);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar({ q: t }), 450);
  }

  const marcadas = valores.contas.length ? valores.contas : contas.map((c) => c.id);
  const todas = marcadas.length === contas.length;
  function alternarConta(id: string) {
    const nova = marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id];
    aplicar({ contas: nova.length ? nova : contas.map((c) => c.id) });
  }
  const mesInteiro = valores.de === mesDe(valores.de).de && valores.ate === mesDe(valores.de).ate;
  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${valores.de}T12:00:00Z`))
    .replace(/^./, (c) => c.toUpperCase());

  const chip = (ativo: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${ativo ? "border-tinta bg-tinta text-white" : "border-borda bg-white text-suave hover:text-texto"}`;

  return (
    <section className={`space-y-3 rounded-2xl border border-borda bg-white p-3 sm:p-4 ${pendente ? "opacity-70" : ""}`} aria-label="Filtros">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-borda">
          <button type="button" onClick={() => aplicar(mesDe(valores.de, -1))} className="px-3 py-2 text-suave hover:text-texto" aria-label="Mês anterior">‹</button>
          <span className="min-w-36 px-1 text-center text-sm font-semibold">{mesInteiro ? nomeMes : "Período"}</span>
          <button type="button" onClick={() => aplicar(mesDe(valores.de, 1))} className="px-3 py-2 text-suave hover:text-texto" aria-label="Próximo mês">›</button>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-suave">
          De
          <input type="date" value={valores.de} max={valores.ate} onChange={(e) => e.target.value && aplicar({ de: e.target.value })} className="campo w-auto px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-suave">
          até
          <input type="date" value={valores.ate} min={valores.de} onChange={(e) => e.target.value && aplicar({ ate: e.target.value })} className="campo w-auto px-2 py-1.5 text-sm" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(false)} onClick={() => aplicar({ de: hoje, ate: hoje })}>Hoje</button>
          <button type="button" className={chip(false)} onClick={() => aplicar(mesDe(hoje))}>Este mês</button>
        </div>
        <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-borda px-3">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-suave" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={busca} onChange={(e) => mudarBusca(e.target.value)} type="search" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" placeholder="Buscar descrição ou categoria" aria-label="Buscar lançamentos" />
        </div>
      </div>

      {/* Contas: caixas de marcar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold text-suave">Contas:</span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={todas} onChange={() => aplicar({ contas: contas.map((c) => c.id) })} className="h-4 w-4 accent-marca" />
          Todas
        </label>
        {contas.map((c) => (
          <label key={c.id} className="flex items-center gap-1.5">
            <input type="checkbox" checked={!todas && marcadas.includes(c.id)} onChange={() => (todas ? aplicar({ contas: [c.id] }) : alternarConta(c.id))} className="h-4 w-4 accent-marca" />
            {c.nome}
          </label>
        ))}
      </div>

      {/* Tipo e situação */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-suave">Tipo:</span>
          {Object.entries(TIPOS_FILTRO).map(([k, r]) => (
            <button key={k} type="button" className={chip(valores.tipo === k)} onClick={() => aplicar({ tipo: k })}>{r}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-suave">Situação:</span>
          {Object.entries(SITUACOES_FILTRO).map(([k, r]) => (
            <button key={k} type="button" className={chip(valores.situacao === k)} onClick={() => aplicar({ situacao: k })}>{r}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
