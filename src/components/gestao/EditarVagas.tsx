"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { salvarConfig } from "@/app/(app)/gestao/financeiro/actions";

/** Lápis no canto do quadro do pátio: abre um campo para mudar quantas vagas a loja tem. */
export function EditarVagas({ vagas }: { vagas: number }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(async (e, f) => {
    const r = await salvarConfig(e, f);
    if (r.sucesso) setAberto(false);
    return r;
  }, {});
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label="Editar quantidade de vagas"
        title="Editar vagas"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-suave transition hover:bg-fundo hover:text-marca-escura"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      </button>
      {aberto && (
        <form action={acao} className="absolute right-0 z-20 mt-1 w-60 space-y-2 rounded-xl border border-borda bg-white p-3 text-left shadow-lg">
          <label className="block text-sm font-medium">
            Vagas no pátio
            <input name="vagas_patio" defaultValue={vagas} inputMode="numeric" maxLength={3} autoFocus className="campo mt-1 py-2" />
          </label>
          <p className="text-xs text-suave">Quantos carros cabem ao mesmo tempo.</p>
          {estado.erro && <p className="text-xs text-perigo">{estado.erro}</p>}
          <button type="submit" disabled={pendente} className="botao-primario w-full py-2 text-sm">{pendente ? "Salvando…" : "Salvar"}</button>
        </form>
      )}
      {estado.sucesso && !aberto && <span className="sr-only" role="status">{estado.sucesso}</span>}
    </div>
  );
}
