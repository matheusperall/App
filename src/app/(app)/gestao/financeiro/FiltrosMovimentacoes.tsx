"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GRUPOS_FILTRO, type ValoresFiltro } from "./filtros";

const iso = (d: Date) => d.toISOString().slice(0, 10);
function mesDe(dia: string, desloca = 0) {
  const [a, m] = dia.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 1 + desloca, 1));
  const fim = new Date(Date.UTC(a, m + desloca, 0));
  return { de: iso(ini), ate: iso(fim) };
}

type Lista = "tipo" | "situacao" | "recorrencia" | "contas";

/** Barra das movimentações: período, busca e um ícone de filtros que abre um menu com caixas de marcar. Tudo aplica na hora. */
export function FiltrosMovimentacoes({ contas, valores, hoje }: { contas: { id: string; nome: string }[]; valores: ValoresFiltro; hoje: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(valores.q);
  const [aberto, setAberto] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  function aplicar(novo: Partial<ValoresFiltro>) {
    const v = { ...valores, ...novo };
    const q = new URLSearchParams();
    q.set("de", v.de);
    q.set("ate", v.ate);
    if (v.contas.length) q.set("contas", v.contas.join(","));
    if (v.tipo.length) q.set("tipo", v.tipo.join(","));
    if (v.situacao.length) q.set("situacao", v.situacao.join(","));
    if (v.recorrencia.length) q.set("recorrencia", v.recorrencia.join(","));
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

  // Fecha o menu ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function alternar(lista: Lista, chave: string) {
    const atual = valores[lista];
    aplicar({ [lista]: atual.includes(chave) ? atual.filter((x) => x !== chave) : [...atual, chave] });
  }
  const qtd = valores.tipo.length + valores.situacao.length + valores.recorrencia.length + valores.contas.length;

  const mesInteiro = valores.de === mesDe(valores.de).de && valores.ate === mesDe(valores.de).ate;
  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${valores.de}T12:00:00Z`))
    .replace(/^./, (c) => c.toUpperCase());
  const chip = "shrink-0 rounded-full border border-borda bg-white px-3 py-1.5 text-sm font-medium text-suave transition hover:text-texto";

  const grupos: { titulo: string; lista: Lista; itens: { chave: string; rotulo: string }[] }[] = [
    ...GRUPOS_FILTRO.map((g) => ({ titulo: g.titulo, lista: g.lista, itens: g.itens.map(([chave, rotulo]) => ({ chave, rotulo })) })),
    { titulo: "Contas", lista: "contas" as const, itens: contas.map((c) => ({ chave: c.id, rotulo: c.nome })) },
  ];

  return (
    <section className={`flex flex-wrap items-center gap-2 rounded-2xl border border-borda bg-white p-3 ${pendente ? "opacity-70" : ""}`} aria-label="Filtros">
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
      <div className="flex gap-1.5">
        <button type="button" className={chip} onClick={() => aplicar({ de: hoje, ate: hoje })}>Hoje</button>
        <button type="button" className={chip} onClick={() => aplicar(mesDe(hoje))}>Este mês</button>
      </div>
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-2 rounded-xl border border-borda px-3">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-suave" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={busca} onChange={(e) => mudarBusca(e.target.value)} type="search" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" placeholder="Buscar descrição ou categoria" aria-label="Buscar lançamentos" />
      </div>

      {/* Ícone de filtros com menu suspenso */}
      <div ref={caixa} className="relative">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-haspopup="true"
          className={`relative flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${qtd ? "border-tinta bg-tinta text-white" : "border-borda text-suave hover:text-texto"}`}
          title="Filtros"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></svg>
          Filtros
          {qtd > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs text-tinta">{qtd}</span>}
        </button>
        {aberto && (
          <div className="absolute right-0 top-full z-[60] mt-2 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-borda bg-white p-4 shadow-xl">
            <button
              type="button"
              disabled={!qtd}
              onClick={() => aplicar({ tipo: [], situacao: [], recorrencia: [], contas: [] })}
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[#d93a3a] disabled:opacity-40"
            >
              ✕ Limpar filtros
            </button>
            {grupos.map((g) =>
              g.itens.length ? (
                <fieldset key={g.titulo} className="mt-3 first-of-type:mt-1">
                  <legend className="mb-1 text-sm font-bold">{g.titulo}</legend>
                  {g.itens.map((i) => (
                    <label key={i.chave} className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-[15px] hover:bg-fundo">
                      <input type="checkbox" checked={valores[g.lista].includes(i.chave)} onChange={() => alternar(g.lista, i.chave)} className="h-5 w-5 shrink-0 rounded accent-marca" />
                      {i.rotulo}
                    </label>
                  ))}
                </fieldset>
              ) : null,
            )}
          </div>
        )}
      </div>
    </section>
  );
}
