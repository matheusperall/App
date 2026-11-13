"use client";

import { useEffect, useRef } from "react";
import { FormAcao } from "@/components/gestao/FormAcao";
import type { Lancamento } from "@/lib/gestao";
import { encerrarSerie, excluirLancamento, marcarPago } from "./actions";

/** Menu "⋮" de cada lançamento: marcar como pago, encerrar a série, apagar. */
export function AcoesLancamento({ l, contas, hoje }: { l: Lancamento; contas: { id: string; nome: string }[]; hoje: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);
  const manual = !l.os_id && !l.fatura_id;
  if (l.pago && !manual) return <span className="w-10" />;
  return (
    <details ref={ref} className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-xl leading-none text-suave hover:bg-fundo [&::-webkit-details-marker]:hidden" aria-label="Ações">⋮</summary>
      <div className="absolute right-0 z-20 mt-1 w-72 space-y-3 rounded-xl border border-borda bg-white p-3 text-left shadow-lg">
        {l.cartao_id && !l.pago && <p className="text-xs text-suave">Compra no cartão: é paga junto com a fatura (Financeiro › Contas › cartão).</p>}
        {!l.pago && !l.cartao_id && (
          <FormAcao acao={marcarPago} campos={{ id: l.id }} botao={l.tipo === "saida" ? "Marcar como pago" : "Marcar como recebido"} pendente="…" classeBotao="botao-primario w-full py-2 text-sm" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select name="conta_id" defaultValue={l.conta_id ?? contas[0]?.id} className="campo px-2 py-2 text-sm" aria-label="Conta">
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input type="date" name="data" defaultValue={hoje} className="campo px-2 py-2 text-sm" aria-label="Data do pagamento" />
            </div>
          </FormAcao>
        )}
        {l.grupo_id && !l.pago && (
          <FormAcao acao={encerrarSerie} campos={{ id: l.id }} botao={l.recorrente ? "Encerrar recorrência (apaga as próximas)" : "Cancelar parcelas restantes"} pendente="…" classeBotao="w-full text-left text-sm text-suave underline" className="" confirmar="Apagar esta e as próximas ainda não pagas desta série?" />
        )}
        {manual && (
          <FormAcao acao={excluirLancamento} campos={{ id: l.id }} botao="Apagar este lançamento" pendente="…" classeBotao="w-full text-left text-sm text-perigo underline" className="" confirmar="Apagar este lançamento?" />
        )}
      </div>
    </details>
  );
}
