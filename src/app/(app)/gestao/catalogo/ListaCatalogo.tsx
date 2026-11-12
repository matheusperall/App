"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIAS, formatarValor } from "@/lib/garagem";
import { combina, custoServico, type ServicoCatalogo } from "@/lib/gestao";

export function ListaCatalogo({ servicos }: { servicos: ServicoCatalogo[] }) {
  const [busca, setBusca] = useState("");
  const [inativos, setInativos] = useState(false);
  const lista = servicos.filter((s) => (inativos || s.ativo) && (!busca.trim() || combina(s.nome, busca)));
  return (
    <div className="space-y-3">
      <input type="search" className="campo" placeholder="Buscar serviço" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar serviço" />
      {servicos.some((s) => !s.ativo) && (
        <label className="flex items-center gap-2 text-sm text-suave">
          <input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} className="h-4 w-4 accent-marca" /> Mostrar inativos
        </label>
      )}
      <div className="overflow-hidden rounded-2xl border border-borda bg-white">
        {lista.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-suave">{busca ? "Nenhum serviço encontrado." : "Nenhum serviço cadastrado."}</p>
        ) : (
          <ul className="divide-y divide-borda">
            {lista.map((s) => {
              const custo = custoServico(s);
              const margem = s.preco - custo;
              return (
                <li key={s.id}>
                  <Link href={`/gestao/catalogo/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-fundo">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.nome}{!s.ativo && <span className="text-xs text-suave"> · inativo</span>}</p>
                      <p className="text-xs text-suave">
                        {CATEGORIAS[s.categoria]?.rotulo} · custo {formatarValor(custo)}
                        {s.consumo.length === 0 && " (sem consumo cadastrado)"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{formatarValor(s.preco)}</p>
                      <p className={`text-xs tabular-nums ${margem < 0 ? "text-perigo" : "text-sucesso"}`}>
                        margem {formatarValor(margem)}{s.preco > 0 && ` · ${Math.round((margem / s.preco) * 100)}%`}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
