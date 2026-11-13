"use client";

import { useState } from "react";
import { SUGESTOES_PREFERENCIAS, limparPreferencias } from "@/lib/garagem";

/**
 * Área de preferências no cadastro do veículo (ex.: "Não mexer nos bancos").
 * Envia `preferencias` (lista), `copiar_para` (outros veículos) e `preferencias_futuros`.
 */
export function PreferenciasVeiculo({ iniciais = [], outros = [] }: { iniciais?: string[]; outros?: { id: string; nome: string }[] }) {
  const [lista, setLista] = useState<string[]>(iniciais);
  const [texto, setTexto] = useState("");
  const [copiar, setCopiar] = useState<string[]>([]);
  const tem = (p: string) => lista.some((x) => x.toLowerCase() === p.toLowerCase());
  const adicionar = (p: string) => setLista((l) => limparPreferencias([...l, p]));
  const remover = (p: string) => setLista((l) => l.filter((x) => x !== p));
  const sugestoes = SUGESTOES_PREFERENCIAS.filter((s) => !tem(s));

  function adicionarTexto() {
    if (texto.trim()) adicionar(texto);
    setTexto("");
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-borda bg-fundo/60 p-4">
      <legend className="px-1 text-sm font-semibold">Preferências do cliente</legend>
      <p className="-mt-1 text-xs text-suave">Cuidados que o cliente pediu. Aparecem como ponto de atenção na ordem de serviço deste veículo.</p>
      {lista.map((p) => <input key={p} type="hidden" name="preferencias" value={p} />)}

      {lista.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Preferências escolhidas">
          {lista.map((p) => (
            <li key={p} className="flex items-center gap-1 rounded-full bg-alerta-claro py-1 pr-1 pl-3 text-sm font-medium text-[#8a5a00]">
              {p}
              <button type="button" onClick={() => remover(p)} className="rounded-full px-1.5 text-base leading-none hover:bg-white/60" aria-label={`Remover ${p}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <button key={s} type="button" onClick={() => adicionar(s)} className="rounded-full border border-borda bg-white px-3 py-1 text-xs text-suave hover:border-marca hover:text-marca-escura">
              + {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionarTexto();
            }
          }}
          maxLength={80}
          className="campo py-2.5"
          placeholder="Outra preferência (ex.: só usar produto neutro)"
          aria-label="Outra preferência"
        />
        <button type="button" onClick={adicionarTexto} disabled={!texto.trim()} className="botao-contorno shrink-0 px-4 py-2.5 text-sm">
          Adicionar
        </button>
      </div>

      {lista.length > 0 && (
        <div className="space-y-2 border-t border-borda pt-3 text-sm">
          {outros.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Copiar também para os outros veículos:</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-marca-escura hover:underline"
                  onClick={() => setCopiar(copiar.length === outros.length ? [] : outros.map((o) => o.id))}
                >
                  {copiar.length === outros.length ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>
              {outros.map((o) => (
                <label key={o.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="copiar_para"
                    value={o.id}
                    checked={copiar.includes(o.id)}
                    onChange={(e) => setCopiar((c) => (e.target.checked ? [...c, o.id] : c.filter((x) => x !== o.id)))}
                    className="h-4 w-4 accent-marca"
                  />
                  {o.nome}
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" name="preferencias_futuros" value="sim" className="h-4 w-4 accent-marca" />
            Usar estas preferências nos próximos veículos cadastrados
          </label>
        </div>
      )}
    </fieldset>
  );
}
